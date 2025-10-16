// Google Sheets Direct Upload Interface
// This handles manual trip logging and URL configuration

class GoogleSheetsManager {
  constructor() {
    this.scriptUrl = localStorage.getItem('googleScriptUrl') || '';
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSavedUrl();
    this.detectNodeMCU();
  }

  bindEvents() {
    // Save URL button
    document.getElementById('saveUrl').addEventListener('click', () => {
      this.saveScriptUrl();
    });

    // Send trip button
    document.getElementById('sendTrip').addEventListener('click', () => {
      this.sendTripEvent();
    });

    // Test connection button
    document.getElementById('testConnection').addEventListener('click', () => {
      this.testConnection();
    });

    // Auto-fill GPS coordinates if geolocation is available
    if (navigator.geolocation) {
      const latInput = document.getElementById('latitude');
      const lngInput = document.getElementById('longitude');
      
      if (latInput.value === '' || lngInput.value === '') {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            latInput.value = position.coords.latitude.toFixed(6);
            lngInput.value = position.coords.longitude.toFixed(6);
            this.log('📍 Auto-filled with your current location');
          },
          () => {
            // Default to Manila coordinates if geolocation fails
            latInput.value = '14.599512';
            lngInput.value = '120.984222';
            this.log('📍 Using default Manila coordinates');
          }
        );
      }
    }
  }

  loadSavedUrl() {
    const urlField = document.getElementById('scriptUrl');
    if (this.scriptUrl) {
      urlField.value = this.scriptUrl;
      this.log('✅ Loaded saved Google Apps Script URL');
    } else {
      this.log('⚠️ No saved Google Apps Script URL found');
    }
  }

  saveScriptUrl() {
    const urlField = document.getElementById('scriptUrl');
    const url = urlField.value.trim();
    
    if (!url) {
      this.log('❌ Please enter a Google Apps Script URL', 'error');
      return;
    }

    if (!url.includes('script.google.com') || !url.includes('/exec')) {
      this.log('❌ Invalid Google Apps Script URL format', 'error');
      this.log('💡 URL should look like: https://script.google.com/macros/s/YOUR_ID/exec');
      return;
    }

    this.scriptUrl = url;
    localStorage.setItem('googleScriptUrl', url);
    this.log('✅ Google Apps Script URL saved successfully!');
  }

  async sendTripEvent() {
    if (!this.scriptUrl) {
      this.log('❌ Please configure Google Apps Script URL first', 'error');
      return;
    }

    const boatName = document.getElementById('boatName').value;
    const eventType = document.getElementById('eventType').value;
    const latitude = parseFloat(document.getElementById('latitude').value);
    const longitude = parseFloat(document.getElementById('longitude').value);
    const locationName = document.getElementById('locationName').value;

    if (!boatName || isNaN(latitude) || isNaN(longitude)) {
      this.log('❌ Please fill in all required fields', 'error');
      return;
    }

    const data = {
      boatName: boatName,
      eventType: eventType,
      latitude: latitude,
      longitude: longitude,
      locationName: locationName,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toISOString().split('T')[1].split('.')[0],
      source: 'Manual Web Entry'
    };

    this.log(`📊 Sending ${eventType} event to Google Sheets...`);
    this.log(`📍 Location: ${latitude}, ${longitude}`);
    this.log(`🚢 Boat: ${boatName}`);

    try {
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const responseText = await response.text();
      
      this.log(`📊 Response Status: ${response.status}`);
      this.log(`📄 Response: ${responseText}`);

      if (response.ok) {
        this.log('✅ SUCCESS: Trip event sent to Google Sheets!', 'success');
        this.log('🔍 Check your Google Sheet for the new entry');
        
        // Clear form after successful submission
        document.getElementById('locationName').value = '';
      } else {
        this.log('⚠️ Unexpected response from Google Apps Script', 'warning');
        this.log('💡 Check the Google Apps Script logs for more details');
      }

    } catch (error) {
      this.log('❌ Failed to send data to Google Sheets', 'error');
      this.log(`🔍 Error: ${error.message}`, 'error');
      this.log('💡 Check your internet connection and script URL');
    }
  }

  async testConnection() {
    if (!this.scriptUrl) {
      this.log('❌ Please configure Google Apps Script URL first', 'error');
      return;
    }

    this.log('🧪 Testing connection to Google Apps Script...');

    const testData = {
      boatName: 'TEST_BOAT',
      eventType: 'DEPARTURE', 
      latitude: 14.599512,
      longitude: 120.984222,
      locationName: 'Test Location',
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toISOString().split('T')[1].split('.')[0],
      source: 'Connection Test'
    };

    try {
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      const responseText = await response.text();
      
      this.log(`🧪 Test Response Status: ${response.status}`);
      this.log(`📄 Test Response: ${responseText}`);

      if (response.ok) {
        this.log('✅ Connection test successful!', 'success');
        this.log('🔍 Check your Google Sheet for test entry');
      } else {
        this.log('⚠️ Connection test failed', 'warning');
        this.log('💡 Check Google Apps Script deployment settings');
      }

    } catch (error) {
      this.log('❌ Connection test failed', 'error');
      this.log(`🔍 Error: ${error.message}`, 'error');
    }
  }

  async detectNodeMCU() {
    // Try to detect local NodeMCU for additional testing options
    const possibleIPs = [
      window.location.hostname,
      '192.168.1.100',
      '192.168.0.100',
      '10.0.0.100'
    ];

    for (const ip of possibleIPs) {
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        try {
          const response = await fetch(`http://${ip}/api/gps`, { 
            timeout: 2000 
          });
          if (response.ok) {
            this.nodeMCU_IP = ip;
            this.log(`📡 Detected NodeMCU at: ${ip}`);
            this.addNodeMCUControls();
            break;
          }
        } catch (e) {
          // Silently continue checking other IPs
        }
      }
    }
  }

  addNodeMCUControls() {
    if (!this.nodeMCU_IP) return;

    const card = document.querySelector('.card');
    const nodeMCUSection = document.createElement('div');
    nodeMCUSection.innerHTML = `
      <div class="card" style="margin-top: 20px; border: 2px solid #4CAF50;">
        <h2>📡 NodeMCU Detected</h2>
        <p class="muted">Direct control of your NodeMCU receiver at ${this.nodeMCU_IP}</p>
        
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px;">
          <button id="nodeMCUTest" class="btn primary">🧪 Test NodeMCU Google Sheets</button>
          <button id="nodeMCUDeparture" class="btn primary">🚢 Force Departure</button>
          <button id="nodeMCUArrival" class="btn primary">⚓ Force Arrival</button>
        </div>
      </div>
    `;

    card.parentNode.appendChild(nodeMCUSection);

    // Bind NodeMCU control events
    document.getElementById('nodeMCUTest').addEventListener('click', () => {
      this.testNodeMCUGoogleSheets();
    });

    document.getElementById('nodeMCUDeparture').addEventListener('click', () => {
      this.forceNodeMCUEvent('departure');
    });

    document.getElementById('nodeMCUArrival').addEventListener('click', () => {
      this.forceNodeMCUEvent('arrival');
    });
  }

  async testNodeMCUGoogleSheets() {
    if (!this.nodeMCU_IP) return;

    this.log('🧪 Testing NodeMCU Google Sheets upload...');

    try {
      const response = await fetch(`http://${this.nodeMCU_IP}/test-google-sheets`);
      const text = await response.text();
      
      this.log('📡 NodeMCU Test Response:');
      this.log(text);
      this.log('🔍 Check Serial Monitor and Google Sheets for results');

    } catch (error) {
      this.log('❌ Failed to trigger NodeMCU test', 'error');
      this.log(`🔍 Error: ${error.message}`, 'error');
    }
  }

  async forceNodeMCUEvent(eventType) {
    if (!this.nodeMCU_IP) return;

    this.log(`📡 Triggering ${eventType.toUpperCase()} event on NodeMCU...`);

    const latitude = document.getElementById('latitude').value || '14.599512';
    const longitude = document.getElementById('longitude').value || '120.984222';

    try {
      const response = await fetch(`http://${this.nodeMCU_IP}/manual-${eventType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `lat=${latitude}&lng=${longitude}`
      });

      const result = await response.json();
      
      this.log(`✅ ${eventType.toUpperCase()} event triggered on NodeMCU`);
      this.log(`📍 Location: ${result.lat}, ${result.lng}`);
      this.log('🔍 Check Serial Monitor and Google Sheets for upload status');

    } catch (error) {
      this.log(`❌ Failed to trigger ${eventType} event`, 'error');
      this.log(`🔍 Error: ${error.message}`, 'error');
    }
  }

  log(message, type = 'info') {
    const logArea = document.getElementById('logArea');
    const activityLog = document.getElementById('activityLog');
    
    // Show log area if hidden
    logArea.style.display = 'block';
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
      <span class="timestamp">[${timestamp}]</span>
      <span class="message">${message}</span>
    `;
    
    activityLog.appendChild(logEntry);
    activityLog.scrollTop = activityLog.scrollHeight;
    
    // Also log to console
    console.log(`[${timestamp}] ${message}`);
  }
}

// Initialize the Google Sheets Manager when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.sheetsManager = new GoogleSheetsManager();
});

// Add CSS for log entries
const logStyles = document.createElement('style');
logStyles.innerHTML = `
  .activity-log {
    max-height: 300px;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 1rem;
    font-family: monospace;
    font-size: 0.9em;
    line-height: 1.4;
  }

  .log-entry {
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    border-left: 3px solid var(--accent);
  }

  .log-entry.error {
    background: rgba(244, 67, 54, 0.1);
    border-left-color: #f44336;
    color: #ffcdd2;
  }

  .log-entry.success {
    background: rgba(76, 175, 80, 0.1);
    border-left-color: #4CAF50;
    color: #c8e6c9;
  }

  .log-entry.warning {
    background: rgba(255, 193, 7, 0.1);
    border-left-color: #FFC107;
    color: #fff9c4;
  }

  .timestamp {
    color: var(--muted);
    margin-right: 0.5rem;
  }

  .message {
    color: var(--text);
  }
`;
document.head.appendChild(logStyles);