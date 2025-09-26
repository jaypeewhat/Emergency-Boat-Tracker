"use strict";

// Defaults — tweak as needed
const DEFAULT_DB_URL = "https://gps-boat-cda8e-default-rtdb.asia-southeast1.firebasedatabase.app";
const DEFAULT_BOAT_ID = "BOAT_001";
const POLL_INTERVAL_MS = 3000; // REST polling cadence
const DISTANCE_THRESHOLD_M = 5; // add to trail if moved > 5 m
const MAX_TRAIL_POINTS = 300;   // keep last N points client-side

// Connection modes
const CONNECTION_FIREBASE = 'firebase';
const CONNECTION_DIRECT = 'direct';

// DOM
const boatIdLabel = document.getElementById("boatIdLabel");
const placeNameLabel = document.getElementById("placeNameLabel");
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
const historyBtn = document.getElementById("historyBtn");
const aboutBtn = document.getElementById("aboutBtn");
const aboutModal = document.getElementById("aboutModal");
const historyModal = document.getElementById("historyModal");
const closeAbout = document.getElementById("closeAbout");
const closeHistory = document.getElementById("closeHistory");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

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
let lastSeenAt = null;       // wall-clock when we last detected a NEW change from LoRa
let lastUpdateSeen = null;   // last value of d.lastUpdate for change detection
let follow = true;           // keep view centered on marker
let appStartTime = Date.now(); // Track when app started

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

  // Show last known location if available
  showLastLocationIfExists();

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
  historyBtn.addEventListener("click", () => { 
    if (historyModal && typeof historyModal.showModal === 'function') {
      loadHistoryData();
      historyModal.showModal();
    }
  });
  if (closeAbout) closeAbout.addEventListener("click", () => { aboutModal?.close(); });
  if (closeHistory) closeHistory.addEventListener("click", () => { historyModal?.close(); });
  if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", clearLocationHistory);

  startPolling();
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

  // Change detection: only use timestamp from LoRa data, not lastUpdate
  let changed = false;
  let actualNewData = false;
  
  // Check if this is genuinely new LoRa data
  if (typeof d.timestamp === "number" && d.timestamp !== lastTimestamp) {
    changed = true;
    actualNewData = true;
    lastTimestamp = d.timestamp;
    lastSeenAt = Date.now();
    console.log("📡 New LoRa data received at timestamp:", d.timestamp);
  }
  
  // Always update labels to show current data (even if old)
  boatIdLabel.textContent = d.boatId || config.boatId;
  const placeName = getPlaceName(d.lat, d.lng);
  placeNameLabel.textContent = placeName;
  latLabel.textContent = d.lat.toFixed(6) + "°";
  lngLabel.textContent = d.lng.toFixed(6) + "°";
  rssiLabel.textContent = d.rssi ?? "—";
  snrLabel.textContent = d.snr ?? "—";
  
  // Only store and track location if it's actually new data
  if (actualNewData) {
    // Store last known location for persistence
    localStorage.setItem('lastLocation', JSON.stringify({
      lat: d.lat,
      lng: d.lng,
      timestamp: Date.now(),
      placeName: placeName
    }));
    
    // Store in location history
    addToLocationHistory(d.lat, d.lng, placeName);
    console.log(`🗺️ Map updated - Lat: ${d.lat.toFixed(6)}, Lng: ${d.lng.toFixed(6)}, RSSI: ${d.rssi}, SNR: ${d.snr}`);
  }
  
  // Show age based on when we last saw NEW data
  ageLabel.textContent = lastSeenAt ? relTime(Date.now() - lastSeenAt) : "—";

  // Map - always show current position
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

  // Only update trail if it's genuinely new data
  if (actualNewData) {
    addToTrail(latlng);
    trail.setLatLngs(trailCoords);
  }

  // Live badge based on data freshness
  const isFresh = isDataFresh();
  liveBadge.classList.toggle("ok", isFresh);
  liveBadge.classList.toggle("warn", !isFresh);
  liveBadge.textContent = isFresh ? "LIVE" : "STALE";
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
  // Fresh if we observed a NEW LoRa data change within last 30s (more strict)
  return !!lastSeenAt && (Date.now() - lastSeenAt <= 30000);
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

// Get readable place name from coordinates
function getPlaceName(lat, lng) {
  const knownPorts = [
    {
      name: 'Mauban Port',
      lat: 14.18984404675852,
      lng: 121.736483747315,
      radius: 0.001 // ~100m tolerance
    },
    {
      name: 'Cagbalete Port',
      lat: 14.257869641394628,
      lng: 121.81942114596045,
      radius: 0.001 // ~100m tolerance
    }
  ];

  // Check if current location matches any known port
  for (const port of knownPorts) {
    const distance = Math.sqrt(
      Math.pow(lat - port.lat, 2) + Math.pow(lng - port.lng, 2)
    );
    
    if (distance <= port.radius) {
      return port.name;
    }
  }
  
  // Return coordinates if no port match
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

// Get last known location from storage
function getLastLocation() {
  try {
    const stored = localStorage.getItem('lastLocation');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Show last known location when app starts
function showLastLocationIfExists() {
  const lastLoc = getLastLocation();
  if (lastLoc && lastLoc.lat && lastLoc.lng) {
    const age = Date.now() - (lastLoc.timestamp || 0);
    const ageStr = relTime(age);
    
    console.log(`📍 Last known location: ${lastLoc.placeName} (${ageStr})`);
    
    // Show on map as a dimmed marker
    if (map && !marker) {
      const lastMarker = L.marker([lastLoc.lat, lastLoc.lng], {
        title: `Last known: ${lastLoc.placeName}`,
        opacity: 0.6
      }).addTo(map);
      
      lastMarker.bindPopup(`
        <div style="text-align: center;">
          <strong>Last Known Location</strong><br>
          <em>${lastLoc.placeName}</em><br>
          <small>Updated ${ageStr}</small>
        </div>
      `);
      
      map.setView([lastLoc.lat, lastLoc.lng], 13);
    }
  }
}

// Location History Management
function addToLocationHistory(lat, lng, placeName) {
  let history = getLocationHistory();
  
  const newEntry = {
    lat,
    lng,
    placeName,
    timestamp: Date.now(),
    date: new Date().toISOString()
  };
  
  // Don't add if it's the same location as the last entry (avoid duplicates when device is off)
  if (history.length > 0) {
    const lastEntry = history[history.length - 1];
    const distance = haversineMeters(lat, lng, lastEntry.lat, lastEntry.lng);
    const timeDiff = newEntry.timestamp - lastEntry.timestamp;
    
    // Skip if same location (< 10m) AND recent (< 5 minutes)
    if (distance < 10 && timeDiff < 300000) {
      console.log(`📍 Skipping duplicate location entry (${distance.toFixed(1)}m away, ${Math.round(timeDiff/1000)}s ago)`);
      return;
    }
  }
  
  history.push(newEntry);
  
  // Keep only last 100 entries
  if (history.length > 100) {
    history = history.slice(-100);
  }
  
  localStorage.setItem('locationHistory', JSON.stringify(history));
  console.log(`📍 Added location to history: ${placeName}`);
}

function getLocationHistory() {
  try {
    const stored = localStorage.getItem('locationHistory');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function clearLocationHistory() {
  localStorage.removeItem('locationHistory');
  loadHistoryData(); // Refresh the display
  console.log('Location history cleared');
}

function loadHistoryData() {
  const history = getLocationHistory();
  const container = document.getElementById('historyTableContainer');
  const totalTripsEl = document.getElementById('totalTrips');
  const lastTripEl = document.getElementById('lastTrip');
  const totalDistanceEl = document.getElementById('totalDistance');
  
  if (!container) return;
  
  // Calculate statistics
  const totalEntries = history.length;
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  let totalDistance = 0;
  
  for (let i = 1; i < history.length; i++) {
    totalDistance += haversineMeters(
      history[i-1].lat, history[i-1].lng,
      history[i].lat, history[i].lng
    );
  }
  
  // Update statistics
  if (totalTripsEl) totalTripsEl.textContent = totalEntries.toString();
  if (lastTripEl) lastTripEl.textContent = lastEntry ? relTime(Date.now() - lastEntry.timestamp) : 'None';
  if (totalDistanceEl) totalDistanceEl.textContent = totalDistance > 1000 ? `${(totalDistance/1000).toFixed(1)} km` : `${Math.round(totalDistance)} m`;
  
  if (history.length === 0) {
    container.innerHTML = '<div class="no-data">No location history available</div>';
    return;
  }
  
  // Create table
  let tableHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Location</th>
          <th>Coordinates</th>
          <th>Age</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Show most recent first
  const recentHistory = history.slice(-20).reverse();
  
  recentHistory.forEach(entry => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const age = relTime(Date.now() - entry.timestamp);
    
    tableHTML += `
      <tr>
        <td>${time}</td>
        <td class="place-name">${entry.placeName}</td>
        <td class="coordinates">${entry.lat.toFixed(6)}, ${entry.lng.toFixed(6)}</td>
        <td class="age">${age}</td>
      </tr>
    `;
  });
  
  tableHTML += `
      </tbody>
    </table>
  `;
  
  container.innerHTML = tableHTML;
}