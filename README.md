# GPS Boat Tracker

A real-time boat tracking system using Arduino, LoRa communication, and modern web technologies. Track your boat's location with automatic trip logging to Google Sheets.

## 🚀 Live Demo

This web application is designed to be deployed on Vercel for optimal performance and global accessibility.

## 📋 Features

- **Real-time GPS Tracking**: Live location updates via LoRa communication
- **Modern Web Interface**: Responsive design with glassmorphism effects
- **Interactive Map**: Leaflet.js with trail visualization and follow mode
- **Automatic Trip Logging**: Smart departure/arrival detection with Google Sheets integration
- **Port Recognition**: Automatic conversion of coordinates to port names
- **Dual Connection Modes**: Firebase real-time database + Direct NodeMCU connection
- **Mobile Optimized**: Fully responsive design for all devices

## 🛠️ Hardware Requirements

- **NodeMCU ESP8266** - Main controller with WiFi capability
- **SX1278 (Ra-02) LoRa Module** - 433MHz communication
- **GPS Module** - For location data (connected to transmitter)

## ⚙️ Software Components

### Arduino Firmware
- **Location**: `../web_receiver_firebase/web_receiver_firebase.ino`
- **Features**: LoRa reception, Firebase sync, Google Sheets upload, trip detection
- **Libraries**: ESP8266WiFi, ArduinoJson, LoRa

### Google Apps Script
- **Location**: `../webapp/GoogleAppsScript_GPS_Boat.gs`
- **Features**: Port recognition, trip pairing, spreadsheet formatting
- **Deployment**: Google Apps Script Web App

### Web Application
- **Frontend**: Vanilla JavaScript, Leaflet.js, CSS3
- **Backend**: Firebase Realtime Database
- **Deployment**: Vercel (recommended)

## 🚀 Deployment Instructions

### 1. Deploy to Vercel

1. **Fork this repository** to your GitHub account

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your forked repository
   - Select this folder (`boat-tracker-app`) as the root directory

3. **Configure Build Settings**:
   ```
   Framework Preset: Other
   Root Directory: boat-tracker-app
   Build Command: (leave empty)
   Output Directory: (leave empty)
   Install Command: (leave empty)
   ```

4. **Deploy**: Vercel will automatically deploy your application

### 2. Alternative: Manual Deployment

You can also deploy to any static hosting service:
- **Netlify**: Drag and drop the `boat-tracker-app` folder
- **GitHub Pages**: Enable Pages in repository settings
- **Firebase Hosting**: Use Firebase CLI to deploy

## 🔧 Configuration

### Arduino Setup

1. **Install Libraries**:
   ```
   ESP8266WiFi
   ESP8266HTTPClient  
   ArduinoJson
   LoRa (by Sandeep Mistry)
   ```

2. **Update WiFi Credentials** in `web_receiver_firebase.ino`:
   ```cpp
   const char* ssid = "YourWiFiSSID";
   const char* password = "YourWiFiPassword";
   ```

3. **Configure Google Apps Script URL**:
   ```cpp
   const String googleScriptURL = "YOUR_GOOGLE_APPS_SCRIPT_URL";
   ```

### Google Sheets Setup

1. **Create Google Sheet** named "Gps_Boat_ESP32"
2. **Add Headers**: Date | Origin | Destination | Boat Name | Arrival Time | Departure Time
3. **Deploy Apps Script** from `GoogleAppsScript_GPS_Boat.gs`
4. **Copy Web App URL** to Arduino firmware

### Firebase Setup (Optional)

1. **Create Firebase Project**
2. **Enable Realtime Database** in Asia Southeast region
3. **Configure Rules** for public read access
4. **Update Database URL** in `app.js` if different from default

## 📍 Port Configuration

Current configured ports:
- **Mauban Port**: 14.18984404675852, 121.736483747315
- **Cagbalete Port**: 14.257869641394628, 121.81942114596045

To add new ports, update the `formatLocation()` function in the Google Apps Script.

## 🔍 Testing

### Arduino Debug Endpoints
- `http://[NodeMCU-IP]/force-departure` - Simulate departure event
- `http://[NodeMCU-IP]/force-arrival` - Simulate arrival event
- `http://[NodeMCU-IP]/test-google-sheets` - Test Google Sheets connection

### Web Interface
- **Live Badge**: Indicates real-time data status
- **Trail Visualization**: Shows boat movement history
- **Responsive Controls**: Follow, Center, Clear trail, About

## 📊 Data Flow

```
GPS Transmitter → LoRa → NodeMCU → WiFi → [Firebase + Google Sheets] → Web Interface
```

1. **GPS transmitter** sends location via LoRa
2. **NodeMCU** receives LoRa packets and uploads to cloud
3. **Web interface** displays real-time location and trail
4. **Trip detection** automatically logs departures/arrivals
5. **Google Sheets** stores trip history with readable port names

## 🎨 Design Features

- **Glassmorphism UI**: Modern frosted glass effects
- **Gradient Animations**: Rainbow text and shimmer effects
- **Floating Elements**: Subtle 3D animations
- **Responsive Layout**: Mobile-first design approach
- **Interactive Feedback**: Hover states and button animations

## 🔧 Customization

### Styling
- Modify `styles.css` for visual customization
- Update gradient colors and animation timing
- Adjust responsive breakpoints

### Functionality  
- Configure polling interval in `app.js`
- Modify trail distance threshold
- Update port coordinates and names

### Hardware
- Adjust LoRa frequency and power settings
- Configure trip detection sensitivity
- Update GPS parsing format

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For issues and questions:
- Check the Arduino Serial Monitor for debug information
- Verify Google Apps Script deployment URL
- Ensure Firebase database rules allow access
- Test LoRa communication range and power

---

**Built with ❤️ for marine navigation and tracking**