// Add Port Location JavaScript
class PortManager {
  constructor() {
    this.firebaseUrl = 'https://gps-boat-cda8e-default-rtdb.asia-southeast1.firebasedatabase.app';
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadRecentEvents();
  }

  bindEvents() {
    // Form submission
    document.getElementById('portForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addTripEvent();
    });

    // Get current location
    document.getElementById('getCurrentLocation').addEventListener('click', () => {
      this.getCurrentLocation();
    });

    // Port selection
    document.querySelectorAll('.port-item').forEach(item => {
      item.addEventListener('click', () => {
        const lat = item.dataset.lat;
        const lng = item.dataset.lng;
        const name = item.dataset.name;
        
        document.getElementById('latitude').value = lat;
        document.getElementById('longitude').value = lng;
        document.getElementById('portName').value = name;
        
        // Visual feedback
        document.querySelectorAll('.port-item').forEach(p => p.classList.remove('selected'));
        item.classList.add('selected');
      });
    });
  }

  getCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    const btn = document.getElementById('getCurrentLocation');
    const originalText = btn.textContent;
    btn.textContent = '📍 Getting location...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        document.getElementById('latitude').value = position.coords.latitude.toFixed(6);
        document.getElementById('longitude').value = position.coords.longitude.toFixed(6);
        document.getElementById('portName').value = 'Current Location';
        
        btn.textContent = '✅ Location obtained';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Error getting your location: ' + error.message);
        btn.textContent = originalText;
        btn.disabled = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  async addTripEvent() {
    const boatId = document.getElementById('boatId').value.trim();
    const eventType = document.getElementById('eventType').value;
    const latitude = parseFloat(document.getElementById('latitude').value);
    const longitude = parseFloat(document.getElementById('longitude').value);
    const portName = document.getElementById('portName').value.trim();

    // Validation
    if (!boatId || !latitude || !longitude) {
      alert('Please fill in all required fields (Boat ID, Latitude, Longitude)');
      return;
    }

    if (latitude < -90 || latitude > 90) {
      alert('Latitude must be between -90 and 90 degrees');
      return;
    }

    if (longitude < -180 || longitude > 180) {
      alert('Longitude must be between -180 and 180 degrees');
      return;
    }

    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Adding event...';
    submitBtn.disabled = true;

    try {
      // Create trip event object
      const tripEvent = {
        boatId: boatId,
        event: eventType.toLowerCase(),
        latitude: latitude,
        longitude: longitude,
        timestamp: new Date().toISOString(),
        rssi: -80, // Default signal strength for manual entries
        snr: 8.0,  // Default SNR for manual entries
        portName: portName || 'Manual Entry',
        source: 'manual'
      };

      // Send to Firebase
      const response = await fetch(`${this.firebaseUrl}/trips.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tripEvent)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Trip event added:', result);

      // Success feedback
      submitBtn.textContent = '✅ Event added successfully!';
      submitBtn.style.background = '#10b981';

      // Reset form
      setTimeout(() => {
        document.getElementById('portForm').reset();
        document.getElementById('boatId').value = 'BOAT_001';
        document.querySelectorAll('.port-item').forEach(p => p.classList.remove('selected'));
        submitBtn.textContent = originalText;
        submitBtn.style.background = '';
        submitBtn.disabled = false;
      }, 2000);

      // Reload recent events
      this.loadRecentEvents();

      // Show success message
      this.showNotification(`${eventType} event added for ${boatId} at ${portName || 'specified location'}`, 'success');

    } catch (error) {
      console.error('Error adding trip event:', error);
      submitBtn.textContent = '❌ Error occurred';
      submitBtn.style.background = '#ef4444';
      
      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.style.background = '';
        submitBtn.disabled = false;
      }, 3000);

      alert('Error adding trip event: ' + error.message);
    }
  }

  async loadRecentEvents() {
    try {
      const response = await fetch(`${this.firebaseUrl}/trips.json?orderBy="timestamp"&limitToLast=5`);
      const data = await response.json();

      const container = document.getElementById('recentEvents');

      if (!data) {
        container.innerHTML = '<div class="no-data">No events found</div>';
        return;
      }

      // Convert to array and sort by timestamp (most recent first)
      const events = Object.entries(data)
        .map(([id, event]) => ({id, ...event}))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      container.innerHTML = events.map(event => {
        const date = new Date(event.timestamp);
        const isManual = event.source === 'manual';
        
        return `
          <div class="event-item ${isManual ? 'manual' : 'auto'}">
            <div class="event-header">
              <span class="event-badge ${event.event}">${event.event.toUpperCase()}</span>
              <span class="event-time">${date.toLocaleString()}</span>
            </div>
            <div class="event-details">
              <span class="boat-id">${event.boatId}</span>
              <span class="location">${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}</span>
              ${event.portName ? `<span class="port-name">${event.portName}</span>` : ''}
            </div>
            <div class="event-source">
              ${isManual ? '👤 Manual Entry' : '🤖 Auto Detected'} • ${event.rssi} dBm
            </div>
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading recent events:', error);
      document.getElementById('recentEvents').innerHTML = 
        '<div class="error">Error loading recent events</div>';
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${type === 'success' ? '✅' : 'ℹ️'}</span>
        <span class="notification-message">${message}</span>
      </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Show animation
    setTimeout(() => notification.classList.add('show'), 100);

    // Remove after 4 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new PortManager();
});