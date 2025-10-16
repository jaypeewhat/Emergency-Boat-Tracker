// Auto Google Sheets Sync for Boat Tracker
class SheetsSync {
  constructor() {
    this.firebaseUrl = 'https://gps-boat-cda8e-default-rtdb.asia-southeast1.firebasedatabase.app';
    this.gasUrl = localStorage.getItem('gasUrl') || '';
    this.sheetId = localStorage.getItem('sheetId') || '';
    this.autoSyncInterval = null;
    this.lastSyncTime = localStorage.getItem('lastSyncTime') || null;
    this.syncedIds = new Set(JSON.parse(localStorage.getItem('syncedIds') || '[]'));
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSettings();
    this.updateUI();
    this.loadPreviewData();
    
    // Start auto sync if enabled
    if (document.getElementById('autoSyncEnabled').checked && this.gasUrl && this.sheetId) {
      this.startAutoSync();
    }
  }

  bindEvents() {
    // Connect button
    document.getElementById('connectBtn').addEventListener('click', () => {
      document.getElementById('gasModal').showModal();
    });

    // Modal actions
    document.getElementById('copyCodeBtn').addEventListener('click', () => {
      const code = document.getElementById('gasCode');
      code.select();
      navigator.clipboard.writeText(code.value);
      this.addLog('📋 Apps Script code copied to clipboard');
    });

    document.getElementById('saveGasBtn').addEventListener('click', () => {
      this.saveGasSettings();
    });

    document.getElementById('closeGasBtn').addEventListener('click', () => {
      document.getElementById('gasModal').close();
    });

    // Sync button
    document.getElementById('syncBtn').addEventListener('click', () => {
      this.syncNow();
    });

    // Auto sync checkbox
    document.getElementById('autoSyncEnabled').addEventListener('change', (e) => {
      if (e.target.checked) {
        this.startAutoSync();
      } else {
        this.stopAutoSync();
      }
      localStorage.setItem('autoSyncEnabled', e.target.checked);
    });

    // Sheet template button
    document.getElementById('createSheetBtn').addEventListener('click', () => {
      this.createSheetTemplate();
    });

    // Sheet ID input
    document.getElementById('sheetIdInput').addEventListener('input', (e) => {
      this.sheetId = e.target.value;
      localStorage.setItem('sheetId', this.sheetId);
      this.updateUI();
    });
  }

  loadSettings() {
    const gasUrl = localStorage.getItem('gasUrl');
    const sheetId = localStorage.getItem('sheetId');
    const autoSync = localStorage.getItem('autoSyncEnabled');
    
    if (gasUrl) {
      document.getElementById('gasUrlInput').value = gasUrl;
      this.gasUrl = gasUrl;
    }
    
    if (sheetId) {
      document.getElementById('sheetIdInput').value = sheetId;
      this.sheetId = sheetId;
    }
    
    if (autoSync !== null) {
      document.getElementById('autoSyncEnabled').checked = autoSync === 'true';
    }
  }

  saveGasSettings() {
    const gasUrl = document.getElementById('gasUrlInput').value.trim();
    const sheetId = document.getElementById('sheetIdInput').value.trim();
    
    if (!gasUrl || !sheetId) {
      alert('Please provide both Google Apps Script URL and Sheet ID');
      return;
    }
    
    // Validate URL format
    if (!gasUrl.includes('script.google.com/macros/s/') || !gasUrl.endsWith('/exec')) {
      alert('❌ Invalid Google Apps Script URL!\n\nPlease use the Web App deployment URL that:\n• Contains "script.google.com/macros/s/"\n• Ends with "/exec"\n\nExample: https://script.google.com/macros/s/AKfycbx.../exec');
      return;
    }
    
    // Validate Sheet ID format
    if (sheetId.length < 30 || sheetId.includes('/') || sheetId.includes('https')) {
      alert('❌ Invalid Sheet ID!\n\nSheet ID should be:\n• A long string of random characters\n• About 44 characters long\n• No slashes or URLs\n\nExample: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
      return;
    }
    
    this.gasUrl = gasUrl;
    this.sheetId = sheetId;
    
    localStorage.setItem('gasUrl', gasUrl);
    localStorage.setItem('sheetId', sheetId);
    
    document.getElementById('gasModal').close();
    this.updateUI();
    this.addLog('✅ Google Sheets connection configured');
    
    // Start auto sync if enabled
    if (document.getElementById('autoSyncEnabled').checked) {
      this.startAutoSync();
    }
  }

  updateUI() {
    const connected = this.gasUrl && this.sheetId;
    
    // Update status badge
    const statusBadge = document.getElementById('statusBadge');
    if (connected) {
      statusBadge.textContent = 'Connected';
      statusBadge.className = 'badge success';
    } else {
      statusBadge.textContent = 'Disconnected';
      statusBadge.className = 'badge warn';
    }
    
    // Enable/disable sync button
    document.getElementById('syncBtn').disabled = !connected;
    
    // Update status info
    document.getElementById('lastSyncTime').textContent = 
      this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString() : 'Never';
    document.getElementById('recordCount').textContent = this.syncedIds.size;
    document.getElementById('sheetStatus').textContent = connected ? 'Connected' : 'Not Connected';
  }

  createSheetTemplate() {
    const templateUrl = 'https://docs.google.com/spreadsheets/create?usp=drive_web';
    window.open(templateUrl, '_blank');
    
    this.addLog('📝 Opening Google Sheets to create new spreadsheet...');
    this.addLog('💡 Tip: Copy the Sheet ID from the URL after creation');
  }

  async loadPreviewData() {
    try {
      const response = await fetch(`${this.firebaseUrl}/trips.json`);
      const data = await response.json();
      
      if (!data) {
        document.getElementById('previewTableBody').innerHTML = 
          '<tr><td colspan="7">No trip data found</td></tr>';
        return;
      }
      
      // Convert to array and sort by timestamp
      const trips = Object.entries(data)
        .map(([id, trip]) => ({id, ...trip}))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10); // Show last 10 records
      
      const tbody = document.getElementById('previewTableBody');
      tbody.innerHTML = trips.map(trip => {
        const date = new Date(trip.timestamp);
        return `
          <tr>
            <td>${date.toLocaleDateString()}</td>
            <td>${date.toLocaleTimeString()}</td>
            <td>${trip.boatId}</td>
            <td><span class="badge ${trip.event === 'departure' ? 'warn' : 'success'}">${trip.event}</span></td>
            <td>${trip.latitude.toFixed(6)}</td>
            <td>${trip.longitude.toFixed(6)}</td>
            <td>${trip.rssi} dBm (${trip.snr} dB)</td>
          </tr>
        `;
      }).join('');
      
    } catch (error) {
      console.error('Error loading preview data:', error);
      document.getElementById('previewTableBody').innerHTML = 
        '<tr><td colspan="7">Error loading data</td></tr>';
    }
  }

  async syncNow() {
    if (!this.gasUrl || !this.sheetId) {
      this.addLog('❌ Please configure Google Sheets connection first');
      return;
    }
    
    try {
      this.addLog('🔄 Starting sync...');
      
      // Fetch new trip data from Firebase
      const response = await fetch(`${this.firebaseUrl}/trips.json`);
      const data = await response.json();
      
      if (!data) {
        this.addLog('ℹ️ No trip data found in Firebase');
        return;
      }
      
      // Filter out already synced records
      const newRecords = Object.entries(data)
        .filter(([id]) => !this.syncedIds.has(id))
        .map(([id, trip]) => ({
          id,
          timestamp: trip.timestamp,
          boatId: trip.boatId,
          event: trip.event,
          latitude: trip.latitude,
          longitude: trip.longitude,
          rssi: trip.rssi,
          snr: trip.snr
        }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      if (newRecords.length === 0) {
        this.addLog('✅ No new records to sync');
        return;
      }
      
      // Send to Google Sheets via Apps Script
      const payload = {
        sheetId: this.sheetId,
        records: newRecords
      };
      
      const gasResponse = await fetch(this.gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!gasResponse.ok) {
        throw new Error(`Apps Script responded with ${gasResponse.status}: ${gasResponse.statusText}`);
      }
      
      const result = await gasResponse.json();
      
      if (result.success) {
        // Mark records as synced
        newRecords.forEach(record => {
          this.syncedIds.add(record.id);
        });
        
        // Update local storage
        localStorage.setItem('syncedIds', JSON.stringify([...this.syncedIds]));
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem('lastSyncTime', this.lastSyncTime);
        
        this.addLog(`✅ Successfully synced ${newRecords.length} new records`);
        this.updateUI();
        
      } else {
        this.addLog(`❌ Sync failed: ${result.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Sync error:', error);
      
      let errorMessage = error.message;
      
      // Provide specific help for common errors
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
        errorMessage = 'CORS Error: Wrong URL format. Please use the Web App deployment URL ending with /exec';
      } else if (error.message.includes('404')) {
        errorMessage = 'URL not found. Please check your Google Apps Script deployment URL';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. Make sure your Apps Script is deployed with "Anyone" access';
      }
      
      this.addLog(`❌ Sync failed: ${errorMessage}`);
    }
  }

  startAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
    
    this.autoSyncInterval = setInterval(() => {
      this.syncNow();
    }, 5 * 60 * 1000); // 5 minutes
    
    this.addLog('🔄 Auto-sync enabled (every 5 minutes)');
  }

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
    
    this.addLog('⏸️ Auto-sync disabled');
  }

  addLog(message) {
    const logContainer = document.getElementById('syncLog');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `<span class="timestamp">${new Date().toLocaleTimeString()}</span> ${message}`;
    
    // Add to top
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    // Keep only last 10 entries
    while (logContainer.children.length > 10) {
      logContainer.removeChild(logContainer.lastChild);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SheetsSync();
});