Boat Tracker Web App (Leaflet + Firebase)

A lightweight, static web UI that shows your boat on a map using data from your Firebase Realtime Database.

Features
- Clean, responsive UI with a big map
- Polls your Firebase RTDB via REST (no SDK needed)
- Configurable Database URL, Boat ID, and optional auth token
- Live/Offline indicator and last-update info
- Optional trail (client-side) with configurable distance threshold

Quick start
1) Open index.html in your browser (double-click works). If your browser blocks cross-origin requests from file://, serve it locally:
   - VS Code Live Server extension, or
   - Python (optional):
     python -m http.server 8080
     Then open http://localhost:8080/webapp/
2) Paste your Database URL and Boat ID (defaults set for your project), then Save.
3) Watch the marker update every few seconds.

Configuration
- URL params: index.html?boat=BOAT_001&db=https://.../&auth=TOKEN
- Saved automatically in localStorage after you click Save.

How it reads data
- Polls GET /boats/{BOAT_ID}.json (optionally with ?auth=TOKEN) every 3 seconds.
- Expects payload like:
  {
    "boatId": "BOAT_001",
    "lat": 13.966441,
    "lng": 121.595806,
    "rssi": -61,
    "snr": 9.75,
    "timestamp": 26152,
    "lastUpdate": 29405
  }

Notes
- Your Arduino sketch currently overwrites the boat record (PUT), which is perfect for a live position. If you later add a history stream under /boats/{id}/history, we can render server-side trails too.
- Security: If your DB is public while testing, no auth is needed. For production, lock rules and provide a read token here, or switch to Firebase Web SDK with proper API keys and auth.
