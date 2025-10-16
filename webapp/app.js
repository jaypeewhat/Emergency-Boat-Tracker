"use strict";

// Defaults — tweak as needed
const DEFAULT_DB_URL = "https://gps-boat-cda8e-default-rtdb.asia-southeast1.firebasedatabase.app";
const DEFAULT_BOAT_ID = "BOAT_001";
const POLL_INTERVAL_MS = 3000; // REST polling cadence
const DISTANCE_THRESHOLD_M = 5; // add to trail if moved > 5 m
const MAX_TRAIL_POINTS = 300;   // keep last N points client-side
const ALERT_POLL_MS = 4000;     // alert polling cadence

// Connection modes
const CONNECTION_FIREBASE = 'firebase';
const CONNECTION_DIRECT = 'direct';

// DOM
const boatIdLabel = document.getElementById("boatIdLabel");
const latLabel = document.getElementById("latLabel");
const lngLabel = document.getElementById("lngLabel");
const rssiLabel = document.getElementById("rssiLabel");
const snrLabel = document.getElementById("snrLabel");
const ageLabel = document.getElementById("ageLabel");
const liveBadge = document.getElementById("liveBadge");
const centerBtn = document.getElementById("centerBtn");
const followBtn = document.getElementById("followBtn");
const fitBtn = document.getElementById("fitBtn");
const clearBtn = document.getElementById("clearBtn");
const aboutBtn = document.getElementById("aboutBtn");
const aboutModal = document.getElementById("aboutModal");
const closeAbout = document.getElementById("closeAbout");

// State
let config = { 
  dbUrl: DEFAULT_DB_URL, 
  boatId: DEFAULT_BOAT_ID, 
  auth: "",
  connectionMode: localStorage.getItem('connectionMode') || CONNECTION_FIREBASE,
  nodeMcuIp: localStorage.getItem('nodeMcuIp') || '',
  nodeMcuPort: localStorage.getItem('nodeMcuPort') || '80'
};
let map, marker, trail;
let trailCoords = [];
let firstFixDone = false;
let lastTimestamp = null;
let fetchTimer = null;
let alertTimer = null;
let lastSeenAt = null;       // wall-clock when we last detected a change
let lastUpdateSeen = null;   // last value of d.lastUpdate for change detection
let follow = true;           // keep view centered on marker
let lastAlertId = localStorage.getItem('lastAlertId') || null;

init();

function init() {
  // Init map
  map = L.map("map", {
    center: [14.5995, 120.9842],
    zoom: 13,
    worldCopyJump: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  trail = L.polyline([], { color: "#22c55e", weight: 3, opacity: 0.9 }).addTo(map);

  // Wire controls
  centerBtn.addEventListener("click", () => {
    follow = true;
    if (marker) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), { animate: true });
  });

  // If the user manually moves the map, pause follow until they hit Center
  map.on("movestart", () => { if (firstFixDone) follow = false; });

  // Header chip actions
  followBtn.addEventListener("click", () => { 
    follow = !follow; 
    followBtn.classList.toggle("active", follow); 
    if (follow && marker) map.panTo(marker.getLatLng()); 
  });
  fitBtn.addEventListener("click", () => { 
    if (trailCoords.length > 0) {
      map.fitBounds(L.latLngBounds(trailCoords), { padding: [20,20] });
      fitBtn.style.transform = 'scale(0.9)';
      setTimeout(() => fitBtn.style.transform = '', 150);
    }
  });
  clearBtn.addEventListener("click", () => { 
    trailCoords = []; 
    trail.setLatLngs([]); 
    clearBtn.style.transform = 'scale(0.9)';
    setTimeout(() => clearBtn.style.transform = '', 150);
  });
  aboutBtn.addEventListener("click", () => { 
    if (aboutModal && typeof aboutModal.showModal === 'function') aboutModal.showModal(); 
  });
  if (closeAbout) closeAbout.addEventListener("click", () => { aboutModal?.close(); });

  startPolling();
  startAlertPolling();
}

function startPolling() {
  if (fetchTimer) clearInterval(fetchTimer);
  fetchOnce();
  fetchTimer = setInterval(fetchOnce, POLL_INTERVAL_MS);
}

function fetchOnce() {
  let url;
  
  if (config.connectionMode === CONNECTION_DIRECT && config.nodeMcuIp) {
    // Direct NodeMCU connection
    url = `http://${config.nodeMcuIp}:${config.nodeMcuPort}/api/gps`;
  } else {
    // Firebase connection (default)
    url = buildBoatUrl(config);
  }

  fetch(url, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      console.log(`📡 ${config.connectionMode === CONNECTION_DIRECT ? 'Direct NodeMCU' : 'Firebase'} data:`, data);
      handleData(data);
    })
    .catch((err) => {
      console.error("Fetch error", err);
      liveBadge.classList.remove("ok");
      liveBadge.classList.add("warn");
      liveBadge.textContent = config.connectionMode === CONNECTION_DIRECT ? "DIRECT ERROR" : "OFFLINE";
    });
}

function handleData(d) {
  if (!d || typeof d.lat !== "number" || typeof d.lng !== "number") {
    liveBadge.classList.remove("ok");
    liveBadge.classList.add("warn");
    liveBadge.textContent = "WAITING";
    return;
  }

  // Labels
  boatIdLabel.textContent = d.boatId || config.boatId;
  latLabel.textContent = d.lat.toFixed(6) + "°";
  lngLabel.textContent = d.lng.toFixed(6) + "°";
  rssiLabel.textContent = d.rssi ?? "—";
  snrLabel.textContent = d.snr ?? "—";

  // Change detection: only use timestamp from LoRa data, not lastUpdate
  let changed = false;
  if (typeof d.timestamp === "number" && d.timestamp !== lastTimestamp) {
    changed = true;
    lastTimestamp = d.timestamp;
  }
  
  if (changed) {
    lastSeenAt = Date.now();
    console.log("📡 New LoRa data received at timestamp:", d.timestamp);
  }
  
  ageLabel.textContent = lastSeenAt ? relTime(Date.now() - lastSeenAt) : "—";

  // Map
  const latlng = [d.lat, d.lng];
  if (!marker) {
    marker = L.marker(latlng, { title: d.boatId || config.boatId }).addTo(map);
  } else {
    marker.setLatLng(latlng);
  }

  if (!firstFixDone) {
    map.setView(latlng, 15, { animate: true });
    firstFixDone = true;
  }

  if (follow) map.panTo(latlng, { animate: true });

  // Trail
  addToTrail(latlng);
  trail.setLatLngs(trailCoords);

  // Live badge
  const isFresh = isDataFresh();
  liveBadge.classList.toggle("ok", isFresh);
  liveBadge.classList.toggle("warn", !isFresh);
  liveBadge.textContent = isFresh ? "LIVE" : "STALE";

  // Only log when we have actual new data
  if (changed) {
    console.log(`🗺️ Map updated - Lat: ${d.lat.toFixed(6)}, Lng: ${d.lng.toFixed(6)}, RSSI: ${d.rssi}, SNR: ${d.snr}`);
  }
}

function startAlertPolling() {
  if (alertTimer) clearInterval(alertTimer);
  // Ask for notification permission once
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  const poll = () => {
    const base = (config.dbUrl || DEFAULT_DB_URL).replace(/\/$/, "");
    const url = `${base}/alerts/latest.json`;
    fetch(url, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(alert => {
        if (!alert || !alert.id) return;
        if (lastAlertId === alert.id) return; // already handled
        lastAlertId = alert.id;
        localStorage.setItem('lastAlertId', lastAlertId);
        showEmergencyBanner(alert);
        pushNotification(alert);
      })
      .catch(() => {});
  };
  poll();
  alertTimer = setInterval(poll, ALERT_POLL_MS);
}

function showEmergencyBanner(alert) {
  const banner = document.getElementById('emergencyBanner');
  if (!banner) return;
  const msg = alert.message || 'EMERGENCY';
  const where = (typeof alert.lat === 'number' && typeof alert.lng === 'number')
    ? `@ ${alert.lat.toFixed(6)}, ${alert.lng.toFixed(6)}`
    : '';
  const textEl = banner.querySelector('.msg');
  if (textEl) textEl.textContent = `${msg} ${where}`.trim();
  banner.classList.add('show');
  // auto-hide after 20s, still dismissible via ✕
  setTimeout(() => banner.classList.remove('show'), 20000);
}

function pushNotification(alert) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const body = (alert.message || 'EMERGENCY') +
    ((typeof alert.lat === 'number' && typeof alert.lng === 'number')
      ? `\n${alert.lat.toFixed(6)}, ${alert.lng.toFixed(6)}`
      : '');
  try { new Notification('🚨 Boat Emergency', { body }); } catch {}
}

function addToTrail(latlng) {
  if (trailCoords.length === 0) {
    trailCoords.push(latlng);
    return;
  }
  const last = trailCoords[trailCoords.length - 1];
  const dist = haversineMeters(last[0], last[1], latlng[0], latlng[1]);
  if (dist >= DISTANCE_THRESHOLD_M) {
    trailCoords.push(latlng);
    if (trailCoords.length > MAX_TRAIL_POINTS) {
      trailCoords.splice(0, trailCoords.length - MAX_TRAIL_POINTS);
    }
  }
}

function isDataFresh() {
  // Fresh if we observed a change within last 15s (client-wall clock)
  return !!lastSeenAt && (Date.now() - lastSeenAt <= 15000);
}

function relTime(ms) {
  if (ms < 1000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

// removed config UI & persistence; using defaults

function buildBoatUrl(cfg) {
  const base = (cfg.dbUrl || DEFAULT_DB_URL).replace(/\/$/, "");
  const path = `/boats/${encodeURIComponent(cfg.boatId || DEFAULT_BOAT_ID)}.json`;
  const q = cfg.auth ? `?auth=${encodeURIComponent(cfg.auth)}` : "";
  return base + path + q;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function startMillis() {
  // Best-effort anchor for device millis to wall time; used only for relative labels
  if (!startMillis._t0) startMillis._t0 = Date.now();
  return startMillis._t0;
}
