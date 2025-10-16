/*
 * Arduino Code Snippet for Google Apps Script Integration
 * Add this to your existing NodeMCU code
 */

// Google Apps Script Configuration
const String GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID_HERE/exec";

// Function to upload trip event to Google Sheets
void uploadTripToGoogleSheets(String eventType, double lat, double lng, String locationName = "") {
  if (!WiFi.isConnected()) {
    Serial.println("⚠️  Cannot upload to Google Sheets: WiFi disconnected");
    return;
  }

  Serial.println("📊 Uploading trip event to Google Sheets...");
  
  BearSSL::WiFiClientSecure client;
  HTTPClient https;
  
  client.setInsecure(); // Skip certificate verification for simplicity
  client.setBufferSizes(1024, 1024); // Reduce TLS buffer sizes
  
  if (https.begin(client, GOOGLE_SCRIPT_URL)) {
    https.addHeader("Content-Type", "application/json");
    https.useHTTP10(true);    // Reduce memory usage
    https.setReuse(false);    // Do not keep connections alive
    
    // Create JSON payload for Google Apps Script
    StaticJsonDocument<512> doc;
    doc["event"] = eventType;                    // "DEPARTURE" or "ARRIVAL"
    doc["boatName"] = currentGPS.boatId;         // Boat identifier
    doc["latitude"] = lat;                       // GPS latitude
    doc["longitude"] = lng;                      // GPS longitude
    doc["locationName"] = locationName;          // Optional: "Manila Harbor", "Cebu Port", etc.
    doc["timestamp"] = millis();                 // Arduino timestamp
    doc["rssi"] = currentGPS.rssi;              // LoRa signal strength
    doc["snr"] = currentGPS.snr;                // LoRa signal quality
    
    String jsonString;
    jsonString.reserve(400); // Pre-allocate memory
    serializeJson(doc, jsonString);
    
    Serial.println("📄 Sending JSON: " + jsonString);
    
    // Make the POST request to Google Apps Script
    int httpCode = https.POST(jsonString);
    
    if (httpCode > 0) {
      String response = https.getString();
      Serial.println("📊 Google Sheets Response (" + String(httpCode) + "): " + response);
      
      if (httpCode == 200) {
        Serial.println("✅ Trip event uploaded to Google Sheets successfully!");
      } else {
        Serial.println("⚠️  Google Sheets upload warning: HTTP " + String(httpCode));
      }
    } else {
      Serial.println("❌ Google Sheets upload failed: " + https.errorToString(httpCode));
    }
    
    https.end();
  } else {
    Serial.println("❌ Failed to connect to Google Apps Script");
  }
}

// Modified trip detection function
void detectTripEvents() {
  if (!currentGPS.valid) return;
  
  unsigned long currentTime = millis();
  double distance = haversineDistance(lastKnownLat, lastKnownLng, 
                                     currentGPS.latitude, currentGPS.longitude);
  
  // Check if boat is moving (distance > threshold)
  if (distance > MOVEMENT_DISTANCE) {
    lastMovementTime = currentTime;
    lastKnownLat = currentGPS.latitude;
    lastKnownLng = currentGPS.longitude;
  }
  
  // Departure detection: boat starts moving and keeps moving for 1 minute
  if (!isMoving && (currentTime - lastMovementTime > MOVEMENT_THRESHOLD)) {
    Serial.println("🚢 DEPARTURE detected!");
    isMoving = true;
    
    // Upload departure event to Google Sheets
    uploadTripToGoogleSheets("DEPARTURE", currentGPS.latitude, currentGPS.longitude, "");
    
    // Also log to Firebase if enabled
    logTripEvent("DEPARTURE", currentGPS.latitude, currentGPS.longitude);
  }
  
  // Arrival detection: boat stops moving and stays stationary for 3 minutes
  if (isMoving && (currentTime - lastMovementTime > STATIONARY_THRESHOLD)) {
    Serial.println("⚓ ARRIVAL detected!");
    isMoving = false;
    
    // Upload arrival event to Google Sheets
    uploadTripToGoogleSheets("ARRIVAL", currentGPS.latitude, currentGPS.longitude, "");
    
    // Also log to Firebase if enabled
    logTripEvent("ARRIVAL", currentGPS.latitude, currentGPS.longitude);
  }
}

// Manual function to log departure with location name
void manualDeparture(double lat, double lng, String locationName) {
  Serial.println("📝 Manual departure logged: " + locationName);
  uploadTripToGoogleSheets("DEPARTURE", lat, lng, locationName);
}

// Manual function to log arrival with location name
void manualArrival(double lat, double lng, String locationName) {
  Serial.println("📝 Manual arrival logged: " + locationName);
  uploadTripToGoogleSheets("ARRIVAL", lat, lng, locationName);
}

// Add these endpoints to your web server setup
void setupGoogleSheetsEndpoints() {
  // Manual departure endpoint
  server.on("/manual-departure", HTTP_POST, []() {
    if (server.hasArg("lat") && server.hasArg("lng")) {
      double lat = server.arg("lat").toDouble();
      double lng = server.arg("lng").toDouble();
      String location = server.arg("location");
      
      manualDeparture(lat, lng, location);
      server.send(200, "text/plain", "Departure logged to Google Sheets");
    } else {
      server.send(400, "text/plain", "Missing lat/lng parameters");
    }
  });
  
  // Manual arrival endpoint
  server.on("/manual-arrival", HTTP_POST, []() {
    if (server.hasArg("lat") && server.hasArg("lng")) {
      double lat = server.arg("lat").toDouble();
      double lng = server.arg("lng").toDouble();
      String location = server.arg("location");
      
      manualArrival(lat, lng, location);
      server.send(200, "text/plain", "Arrival logged to Google Sheets");
    } else {
      server.send(400, "text/plain", "Missing lat/lng parameters");
    }
  });
}

/*
 * SETUP INSTRUCTIONS:
 * 
 * 1. Copy the Google Apps Script code to script.google.com
 * 2. Deploy as Web App with "Execute as: Me" and "Access: Anyone"
 * 3. Copy the deployment URL and replace YOUR_DEPLOYMENT_ID_HERE above
 * 4. Add this code to your existing NodeMCU sketch
 * 5. Call setupGoogleSheetsEndpoints() in your setup() function
 * 6. The system will automatically log departures and arrivals to your sheet
 * 
 * Your Google Sheet will be populated with:
 * - Date: YYYY-MM-DD format
 * - Origin: Departure location (coordinates or name)
 * - Destination: Arrival location (coordinates or name) 
 * - Boat Name: Your boat ID
 * - Arrival Time: HH:MM:SS when boat arrives
 * - Departure Time: HH:MM:SS when boat departs
 */