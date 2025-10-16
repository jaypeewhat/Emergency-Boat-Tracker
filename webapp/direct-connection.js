// Direct NodeMCU Connection JavaScript
class DirectConnection {
  constructor() {
    this.nodeMcuIp = localStorage.getItem('nodeMcuIp') || '';
    this.nodeMcuPort = localStorage.getItem('nodeMcuPort') || '80';
    this.connected = false;
    this.pollTimer = null;
    this.pollInterval = 2000; // Poll every 2 seconds
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSettings();
    this.updateUI();
    
    // Auto-connect if we have saved settings
    if (this.nodeMcuIp) {
      this.connect();
    }
  }

  bindEvents() {
    document.getElementById('scanBtn').addEventListener('click', () => {
      this.scanNetwork();
    });

    document.getElementById('testConnection').addEventListener('click', () => {
      this.testConnection();
    });

    document.getElementById('saveConnection').addEventListener('click', () => {
      this.saveAndConnect();
    });

    // Auto-validate IP input
    document.getElementById('nodeMcuIp').addEventListener('input', (e) => {
      this.validateIpInput(e.target);
    });
  }

  loadSettings() {
    document.getElementById('nodeMcuIp').value = this.nodeMcuIp;
    document.getElementById('nodeMcuPort').value = this.nodeMcuPort;
  }

  validateIpInput(input) {
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const isValid = ipPattern.test(input.value);
    
    input.style.borderColor = isValid ? '#10b981' : '#ef4444';
    document.getElementById('connectBtn').disabled = !isValid || !input.value;
  }

  async scanNetwork() {
    const scanBtn = document.getElementById('scanBtn');
    const scanResults = document.getElementById('scanResults');
    
    scanBtn.textContent = '🔍 Scanning...';
    scanBtn.disabled = true;
    
    scanResults.innerHTML = '<div class="scanning">🔄 Scanning network for NodeMCU devices...</div>';

    // Common IP ranges to scan
    const baseIp = this.getNetworkBase();
    const scanPromises = [];
    
    // Scan common ports and IP ranges
    for (let i = 1; i <= 254; i++) {
      const ip = `${baseIp}.${i}`;
      scanPromises.push(this.checkDevice(ip, 80));
    }

    try {
      const results = await Promise.allSettled(scanPromises);
      const foundDevices = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);

      this.displayScanResults(foundDevices);
      
    } catch (error) {
      console.error('Scan error:', error);
      scanResults.innerHTML = '<div class="error">❌ Scan failed: ' + error.message + '</div>';
    }

    scanBtn.textContent = '🔍 Scan Network';
    scanBtn.disabled = false;
  }

  getNetworkBase() {
    // Try to guess network base from current page URL or common patterns
    const hostname = window.location.hostname;
    if (hostname.includes('192.168.1.')) return '192.168.1';
    if (hostname.includes('192.168.0.')) return '192.168.0';
    if (hostname.includes('10.0.0.')) return '10.0.0';
    
    // Default to most common
    return '192.168.1';
  }

  async checkDevice(ip, port) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      const response = await fetch(`http://${ip}:${port}/api/gps`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return {
          ip: ip,
          port: port,
          data: data,
          isNodeMCU: true
        };
      }
    } catch (error) {
      // Device not responsive or not a NodeMCU
      return null;
    }
    
    return null;
  }

  displayScanResults(devices) {
    const scanResults = document.getElementById('scanResults');
    
    if (devices.length === 0) {
      scanResults.innerHTML = `
        <div class="no-results">
          ❌ No NodeMCU devices found<br>
          <small>Make sure your NodeMCU is connected to the same WiFi network</small>
        </div>
      `;
      return;
    }

    const deviceList = devices.map(device => `
      <div class="device-item" onclick="window.directConnection.selectDevice('${device.ip}', ${device.port})">
        <div class="device-header">
          <span class="device-ip">📡 ${device.ip}:${device.port}</span>
          <span class="device-status">✅ NodeMCU Found</span>
        </div>
        <div class="device-details">
          <span>Boat: ${device.data.boatId || 'Unknown'}</span>
          <span>GPS: ${device.data.lat ? 'Active' : 'No Signal'}</span>
          ${device.data.lat ? `<span>Lat: ${device.data.lat.toFixed(6)}</span>` : ''}
          ${device.data.lng ? `<span>Lng: ${device.data.lng.toFixed(6)}</span>` : ''}
        </div>
      </div>
    `).join('');

    scanResults.innerHTML = `
      <div class="scan-header">✅ Found ${devices.length} NodeMCU device(s)</div>
      ${deviceList}
    `;

    // Auto-select if only one device found
    if (devices.length === 1) {
      this.selectDevice(devices[0].ip, devices[0].port);
    }
  }

  selectDevice(ip, port) {
    document.getElementById('nodeMcuIp').value = ip;
    document.getElementById('nodeMcuPort').value = port;
    this.validateIpInput(document.getElementById('nodeMcuIp'));
  }

  async testConnection() {
    const ip = document.getElementById('nodeMcuIp').value.trim();
    const port = document.getElementById('nodeMcuPort').value.trim();
    
    if (!ip || !port) {
      alert('Please enter IP address and port');
      return;
    }

    const testBtn = document.getElementById('testConnection');
    testBtn.textContent = '🧪 Testing...';
    testBtn.disabled = true;

    try {
      const response = await fetch(`http://${ip}:${port}/api/gps`, {
        method: 'GET',
        timeout: 5000
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Connection successful!\n\nBoat ID: ${data.boatId || 'Unknown'}\nGPS Status: ${data.lat ? 'Active' : 'No Signal'}\nLast Update: ${data.timestamp || 'Unknown'}`);
      } else {
        alert(`❌ Connection failed!\n\nHTTP Status: ${response.status}\nMake sure the NodeMCU is running and accessible.`);
      }
    } catch (error) {
      alert(`❌ Connection failed!\n\nError: ${error.message}\n\nMake sure:\n• NodeMCU is powered on\n• Connected to same WiFi network\n• IP address is correct\n• Port 80 is accessible`);
    }

    testBtn.textContent = '🧪 Test Connection';
    testBtn.disabled = false;
  }

  saveAndConnect() {
    const ip = document.getElementById('nodeMcuIp').value.trim();
    const port = document.getElementById('nodeMcuPort').value.trim();
    
    if (!ip || !port) {
      alert('Please enter IP address and port');
      return;
    }

    this.nodeMcuIp = ip;
    this.nodeMcuPort = port;
    
    localStorage.setItem('nodeMcuIp', ip);
    localStorage.setItem('nodeMcuPort', port);
    
    this.connect();
  }

  connect() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(() => {
      this.fetchData();
    }, this.pollInterval);

    // Fetch immediately
    this.fetchData();
  }

  async fetchData() {
    try {
      const response = await fetch(`http://${this.nodeMcuIp}:${this.nodeMcuPort}/api/gps`);
      
      if (response.ok) {
        const data = await response.json();
        this.handleDataSuccess(data);
      } else {
        this.handleDataError(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.handleDataError(error.message);
    }
  }

  handleDataSuccess(data) {
    this.connected = true;
    
    // Update status
    document.getElementById('connectionStatus').textContent = 'Connected';
    document.getElementById('connectionStatus').style.color = '#10b981';
    document.getElementById('lastDataTime').textContent = new Date().toLocaleTimeString();
    document.getElementById('dataSource').textContent = `${this.nodeMcuIp}:${this.nodeMcuPort}`;
    
    // Update GPS data
    document.getElementById('currentBoatId').textContent = data.boatId || '—';
    document.getElementById('currentLat').textContent = data.lat ? data.lat.toFixed(6) + '°' : '—';
    document.getElementById('currentLng').textContent = data.lng ? data.lng.toFixed(6) + '°' : '—';
    document.getElementById('currentRssi').textContent = data.rssi || '—';
    document.getElementById('currentSnr').textContent = data.snr || '—';
    document.getElementById('currentTimestamp').textContent = data.timestamp ? new Date(data.timestamp).toLocaleString() : '—';
    
    // Show details
    document.getElementById('connectionDetails').style.display = 'block';
    
    this.updateUI();
  }

  handleDataError(error) {
    this.connected = false;
    
    // Update status
    document.getElementById('connectionStatus').textContent = 'Error';
    document.getElementById('connectionStatus').style.color = '#ef4444';
    
    console.error('Data fetch error:', error);
    this.updateUI();
  }

  updateUI() {
    const statusBadge = document.getElementById('statusBadge');
    const connectBtn = document.getElementById('connectBtn');
    
    if (this.connected) {
      statusBadge.textContent = 'Connected';
      statusBadge.className = 'badge success';
      connectBtn.textContent = 'Reconnect';
      connectBtn.disabled = false;
    } else {
      statusBadge.textContent = 'Disconnected';
      statusBadge.className = 'badge warn';
      connectBtn.textContent = 'Connect';
      connectBtn.disabled = !this.nodeMcuIp;
    }
  }
}

// Make instance globally available
let directConnection;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  directConnection = new DirectConnection();
  window.directConnection = directConnection; // For device selection clicks
});