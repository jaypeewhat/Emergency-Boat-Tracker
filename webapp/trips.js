"use strict";

// Configuration
const FIREBASE_DB_URL = "https://gps-boat-cda8e-default-rtdb.asia-southeast1.firebasedatabase.app";
const TRIPS_ENDPOINT = `${FIREBASE_DB_URL}/trips.json`;

// DOM Elements
const totalTripsEl = document.getElementById("totalTrips");
const todayTripsEl = document.getElementById("todayTrips");
const weekTripsEl = document.getElementById("weekTrips");
const tripTableBody = document.getElementById("tripTableBody");
const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportBtn");
const csvBtn = document.getElementById("csvBtn");
const copyBtn = document.getElementById("copyBtn");

// Data storage
let tripsData = [];

// Initialize
init();

function init() {
  loadTrips();
  
  // Event listeners
  refreshBtn.addEventListener("click", loadTrips);
  exportBtn.addEventListener("click", exportToExcel);
  csvBtn.addEventListener("click", downloadCSV);
  copyBtn.addEventListener("click", copyToClipboard);
  
  // Auto-refresh every 30 seconds
  setInterval(loadTrips, 30000);
}

async function loadTrips() {
  try {
    console.log("Fetching trips from:", TRIPS_ENDPOINT);
    const response = await fetch(TRIPS_ENDPOINT, { cache: "no-store" });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data) {
      tripsData = [];
    } else {
      // Convert Firebase object to array
      tripsData = Object.entries(data).map(([key, trip]) => ({
        id: key,
        ...trip
      }));
      
      // Sort by timestamp (newest first)
      tripsData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    
    updateStats();
    updateTable();
    
  } catch (error) {
    console.error("Error loading trips:", error);
    tripTableBody.innerHTML = `<tr><td colspan="7" class="error">Failed to load trips: ${error.message}</td></tr>`;
  }
}

function updateStats() {
  const total = tripsData.length;
  const today = new Date().toDateString();
  
  let todayCount = 0;
  let weekCount = 0;
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  tripsData.forEach(trip => {
    const tripDate = new Date(trip.timestamp || 0);
    if (tripDate.toDateString() === today) {
      todayCount++;
    }
    if (trip.timestamp && trip.timestamp > weekAgo) {
      weekCount++;
    }
  });
  
  totalTripsEl.textContent = total;
  todayTripsEl.textContent = todayCount;
  weekTripsEl.textContent = weekCount;
}

function updateTable() {
  if (tripsData.length === 0) {
    tripTableBody.innerHTML = '<tr><td colspan="7" class="no-data">No trip data available</td></tr>';
    return;
  }
  
  tripTableBody.innerHTML = tripsData.map(trip => {
    const date = trip.timestamp ? new Date(trip.timestamp).toLocaleDateString() : "Unknown";
    const time = trip.timestamp ? new Date(trip.timestamp).toLocaleTimeString() : "Unknown";
    const eventClass = trip.event === "DEPARTURE" ? "departure" : "arrival";
    const signal = `${trip.rssi || "N/A"} dBm (${trip.snr || "N/A"} dB)`;
    
    return `
      <tr class="${eventClass}">
        <td>${date}</td>
        <td>${trip.boatId || "Unknown"}</td>
        <td><span class="event-badge ${trip.event?.toLowerCase() || ""}">${trip.event || "Unknown"}</span></td>
        <td>${time}</td>
        <td>${trip.latitude ? trip.latitude.toFixed(6) : "N/A"}</td>
        <td>${trip.longitude ? trip.longitude.toFixed(6) : "N/A"}</td>
        <td>${signal}</td>
      </tr>
    `;
  }).join("");
}

function exportToExcel() {
  if (tripsData.length === 0) {
    alert("No trip data to export");
    return;
  }
  
  // Create Excel-compatible data
  const excelData = [
    ["Date", "Boat ID", "Event", "Time", "Latitude", "Longitude", "RSSI (dBm)", "SNR (dB)"],
    ...tripsData.map(trip => [
      trip.timestamp ? new Date(trip.timestamp).toLocaleDateString() : "Unknown",
      trip.boatId || "Unknown",
      trip.event || "Unknown",
      trip.timestamp ? new Date(trip.timestamp).toLocaleTimeString() : "Unknown",
      trip.latitude || "N/A",
      trip.longitude || "N/A",
      trip.rssi || "N/A",
      trip.snr || "N/A"
    ])
  ];
  
  // Convert to CSV format
  const csvContent = excelData.map(row => 
    row.map(cell => `"${cell}"`).join(",")
  ).join("\\n");
  
  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `boat_trips_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  
  console.log("Excel file exported successfully");
}

function downloadCSV() {
  exportToExcel(); // Same function for now
}

async function copyToClipboard() {
  if (tripsData.length === 0) {
    alert("No trip data to copy");
    return;
  }
  
  const headers = ["Date", "Boat ID", "Event", "Time", "Latitude", "Longitude", "RSSI", "SNR"];
  const rows = tripsData.map(trip => [
    trip.timestamp ? new Date(trip.timestamp).toLocaleDateString() : "Unknown",
    trip.boatId || "Unknown",
    trip.event || "Unknown",
    trip.timestamp ? new Date(trip.timestamp).toLocaleTimeString() : "Unknown",
    trip.latitude?.toFixed(6) || "N/A",
    trip.longitude?.toFixed(6) || "N/A",
    trip.rssi || "N/A",
    trip.snr || "N/A"
  ]);
  
  const clipboardData = [headers, ...rows]
    .map(row => row.join("\\t"))
    .join("\\n");
  
  try {
    await navigator.clipboard.writeText(clipboardData);
    alert("Trip data copied to clipboard! You can paste it directly into Excel.");
  } catch (err) {
    console.error("Failed to copy:", err);
    alert("Failed to copy to clipboard");
  }
}