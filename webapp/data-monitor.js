// Data Monitor JavaScript
class DataMonitor {
  constructor() {
    this.firebaseUrl = 'https://gps-boat-cda8e-default-rtdb.asia-southeast1.firebasedatabase.app';
    this.boatId = 'BOAT_001';
    this.pollInterval = 2000; // Check every 2 seconds
    this.lastLoraTimestamp = null;
    this.lastFirebaseUpdate = null;
    this.firebaseUpdateCount = 0;
    this.pollTimer = null;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.startMonitoring();
  }

  bindEvents() {
    document.getElementById('clearLog').addEventListener('click', () => {
      this.clearLog();
    });
  }

  startMonitoring() {
    this.addLog('Starting data monitoring...', 'info');
    this.pollTimer = setInterval(() => {
      this.fetchData();
    }, this.pollInterval);
    
    // Fetch immediately
    this.fetchData();
  }

  async fetchData() {
    try {
      const response = await fetch(`${this.firebaseUrl}/boats/${this.boatId}.json`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.handleData(data);
      
      document.getElementById('connectionStatus').textContent = 'Connected';
      document.getElementById('connectionStatus').style.color = '#10b981';
      
    } catch (error) {
      console.error('Fetch error:', error);
      document.getElementById('connectionStatus').textContent = 'Error';
      document.getElementById('connectionStatus').style.color = '#ef4444';
      this.addLog(`Connection error: ${error.message}`, 'warning');
    }
  }

  handleData(data) {
    if (!data) {
      this.addLog('No data received from Firebase', 'warning');
      return;
    }

    // Update display
    document.getElementById('boatId').textContent = data.boatId || '—';
    document.getElementById('latitude').textContent = data.lat ? data.lat.toFixed(6) + '°' : '—';
    document.getElementById('longitude').textContent = data.lng ? data.lng.toFixed(6) + '°' : '—';
    document.getElementById('rssi').textContent = data.rssi || '—';
    document.getElementById('snr').textContent = data.snr || '—';
    
    // Handle timestamps
    const loraTimestamp = data.timestamp;
    const firebaseUpdate = data.lastUpdate;
    
    if (loraTimestamp) {
      document.getElementById('loraTimestamp').textContent = this.formatTimestamp(loraTimestamp);
    }
    
    if (firebaseUpdate) {
      document.getElementById('lastUpdate').textContent = this.formatTimestamp(firebaseUpdate);
    }

    // Check for new LoRa data
    if (loraTimestamp && loraTimestamp !== this.lastLoraTimestamp) {
      this.lastLoraTimestamp = loraTimestamp;
      document.getElementById('lastLoraData').textContent = new Date().toLocaleTimeString();
      this.addLog(`📡 New LoRa data received! GPS: ${data.lat?.toFixed(6)}, ${data.lng?.toFixed(6)} | Signal: ${data.rssi} dBm, ${data.snr} dB`, 'success');
    }

    // Check for Firebase updates
    if (firebaseUpdate && firebaseUpdate !== this.lastFirebaseUpdate) {
      this.lastFirebaseUpdate = firebaseUpdate;
      this.firebaseUpdateCount++;
      document.getElementById('firebaseUpdates').textContent = this.firebaseUpdateCount;
      
      // Only log if this Firebase update corresponds to new LoRa data
      if (loraTimestamp === this.lastLoraTimestamp && loraTimestamp) {
        this.addLog(`🔥 Firebase updated with new LoRa data (timestamp: ${loraTimestamp})`, 'info');
      } else {
        this.addLog(`🔄 Firebase heartbeat update (no new LoRa data)`, 'warning');
      }
    }
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return '—';
    
    // Convert Arduino millis() to readable time
    const seconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  addLog(message, type = 'info') {
    const logContainer = document.getElementById('activityLog');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
      <span class="timestamp">[${timestamp}]</span>
      <span class="message">${message}</span>
    `;
    
    // Add to top
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    // Keep only last 20 entries
    while (logContainer.children.length > 20) {
      logContainer.removeChild(logContainer.lastChild);
    }
  }

  clearLog() {
    const logContainer = document.getElementById('activityLog');
    logContainer.innerHTML = '';
    this.addLog('Log cleared', 'info');
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new DataMonitor();
});