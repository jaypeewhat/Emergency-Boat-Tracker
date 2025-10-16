/**
 * Google Apps Script for GPS Boat ESP32 Tracking
 * Project: Gps_Boat_ESP32
 * Sheet ID: 1Ni6-vvSHolnSUC2kM5MwdH2C-BiwcScm0ZSyrMSK6bw
 * Sheet Name: Gps_Boat_ESP32
 * 
 * Table Structure:
 * Date | Origin | Destination | Boat Name | Arrival Time | Departure Time
 */

function doPost(e) {
  try {
    // Handle manual execution vs actual HTTP POST
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log('No POST data received - running in test mode');
      return testScript();
    }
    
    Logger.log('Received POST request: ' + e.postData.contents);
    
    // Parse incoming JSON data
    const data = JSON.parse(e.postData.contents);
    Logger.log('Parsed data: ' + JSON.stringify(data));
    
    // Open the specific Google Sheet
    const sheetId = '1Ni6-vvSHolnSUC2kM5MwdH2C-BiwcScm0ZSyrMSK6bw';
    const sheetName = 'Gps_Boat_ESP32';
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error('Sheet "' + sheetName + '" not found');
    }
    
    // Add headers if the sheet is empty
    if (sheet.getLastRow() === 0) {
      const headers = ['Date', 'Origin', 'Destination', 'Boat Name', 'Arrival Time', 'Departure Time'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      Logger.log('Headers added to sheet');
    }
    
    // Process the data based on event type
    const result = processBoatEvent(sheet, data);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: result.message,
        rowsProcessed: result.rowsProcessed,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function processBoatEvent(sheet, data) {
  const boatName = data.boatName || data.boatId || 'Unknown Boat';
  const currentDate = new Date();
  const dateStr = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), 'HH:mm:ss');
  
  // Create location string from coordinates
  const location = formatLocation(data.latitude, data.longitude, data.locationName);
  
  if (data.event === 'DEPARTURE' || data.event === 'departure') {
    return handleDeparture(sheet, dateStr, timeStr, boatName, location, data);
  } else if (data.event === 'ARRIVAL' || data.event === 'arrival') {
    return handleArrival(sheet, dateStr, timeStr, boatName, location, data);
  } else {
    // Handle general GPS update - create or update current trip
    return handleGPSUpdate(sheet, dateStr, timeStr, boatName, location, data);
  }
}

function handleDeparture(sheet, dateStr, timeStr, boatName, location, data) {
  // Add a new row for departure
  const newRow = [
    dateStr,           // Date
    location,          // Origin (departure location)
    '',               // Destination (empty, will be filled on arrival)
    boatName,         // Boat Name
    '',               // Arrival Time (empty, will be filled later)
    timeStr           // Departure Time
  ];
  
  sheet.appendRow(newRow);
  Logger.log('Departure recorded for ' + boatName + ' from ' + location + ' at ' + timeStr);
  
  return {
    message: 'Departure recorded for ' + boatName + ' from ' + location,
    rowsProcessed: 1
  };
}

function handleArrival(sheet, dateStr, timeStr, boatName, location, data) {
  // Find the most recent departure row for this boat that doesn't have an arrival time
  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  
  for (let i = lastRow; i >= 2; i--) { // Start from row 2 (skip header)
    const rowData = sheet.getRange(i, 1, 1, 6).getValues()[0];
    const rowBoatName = rowData[3]; // Boat Name column
    const arrivalTime = rowData[4];  // Arrival Time column
    
    if (rowBoatName === boatName && (arrivalTime === '' || arrivalTime === null)) {
      foundRow = i;
      break;
    }
  }
  
  if (foundRow > 0) {
    // Update existing row with arrival information
    sheet.getRange(foundRow, 3).setValue(location);  // Destination
    sheet.getRange(foundRow, 5).setValue(timeStr);   // Arrival Time
    
    Logger.log('Arrival recorded for ' + boatName + ' at ' + location + ' at ' + timeStr);
    
    return {
      message: 'Arrival recorded for ' + boatName + ' at ' + location,
      rowsProcessed: 1
    };
  } else {
    // No matching departure found, create a new row with just arrival
    const newRow = [
      dateStr,          // Date
      'Unknown',        // Origin (unknown since no departure recorded)
      location,         // Destination (arrival location)
      boatName,         // Boat Name
      timeStr,          // Arrival Time
      ''               // Departure Time (empty)
    ];
    
    sheet.appendRow(newRow);
    Logger.log('Arrival recorded for ' + boatName + ' at ' + location + ' (no matching departure found)');
    
    return {
      message: 'Arrival recorded for ' + boatName + ' at ' + location + ' (new trip)',
      rowsProcessed: 1
    };
  }
}

function handleGPSUpdate(sheet, dateStr, timeStr, boatName, location, data) {
  // For general GPS updates, just log the location
  // This could be used for tracking or updating current position
  Logger.log('GPS update for ' + boatName + ' at ' + location);
  
  return {
    message: 'GPS position updated for ' + boatName,
    rowsProcessed: 0
  };
}

function formatLocation(latitude, longitude, locationName) {
  if (locationName && locationName !== '') {
    return locationName;
  }
  
  if (latitude && longitude) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    // Check if coordinates match known ports (within ~100m radius)
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
        Logger.log('Location matched known port: ' + port.name + ' (distance: ' + distance.toFixed(6) + ')');
        return port.name;
      }
    }
    
    // Format coordinates to 6 decimal places if no port match
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    return latStr + ', ' + lngStr;
  }
  
  return 'Unknown Location';
}

// Test function - you can run this manually to test the script
function testScript() {
  try {
    Logger.log('=== MANUAL TEST EXECUTION ===');
    
    // Simulate a departure event from Mauban Port
    const testData = {
      event: 'DEPARTURE',
      boatName: 'TEST_BOAT_MANUAL',
      latitude: 14.18984404675852,
      longitude: 121.736483747315,
      timestamp: new Date().toISOString(),
      source: 'Manual Test Execution'
    };
    
    Logger.log('Test data: ' + JSON.stringify(testData));
    
    // Open the specific Google Sheet
    const sheetId = '1Ni6-vvSHolnSUC2kM5MwdH2C-BiwcScm0ZSyrMSK6bw';
    const sheetName = 'Gps_Boat_ESP32';
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error('Sheet "' + sheetName + '" not found');
    }
    
    // Add headers if the sheet is empty
    if (sheet.getLastRow() === 0) {
      const headers = ['Date', 'Origin', 'Destination', 'Boat Name', 'Arrival Time', 'Departure Time'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      Logger.log('Headers added to sheet');
    }
    
    // Process the test departure
    const result = processBoatEvent(sheet, testData);
    Logger.log('Test completed successfully: ' + result.message);
    
    // Test arrival at Cagbalete Port
    const arrivalData = {
      event: 'ARRIVAL',
      boatName: 'TEST_BOAT_MANUAL',
      latitude: 14.257869641394628,
      longitude: 121.81942114596045,
      timestamp: new Date().toISOString(),
      source: 'Manual Test Execution'
    };
    
    const arrivalResult = processBoatEvent(sheet, arrivalData);
    Logger.log('Arrival test completed: ' + arrivalResult.message);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Manual test completed successfully',
        departureResult: result,
        arrivalResult: arrivalResult,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Test error: ' + error.toString());
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        message: 'Manual test failed',
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to manually add headers (run once if needed)
function addHeaders() {
  const sheetId = '1Ni6-vvSHolnSUC2kM5MwdH2C-BiwcScm0ZSyrMSK6bw';
  const sheetName = 'Gps_Boat_ESP32';
  
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  const headers = ['Date', 'Origin', 'Destination', 'Boat Name', 'Arrival Time', 'Departure Time'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  Logger.log('Headers added successfully');
}

// Simple test function you can run directly from the editor
function runSimpleTest() {
  Logger.log('=== SIMPLE TEST FUNCTION ===');
  
  try {
    const sheetId = '1Ni6-vvSHolnSUC2kM5MwdH2C-BiwcScm0ZSyrMSK6bw';
    const sheetName = 'Gps_Boat_ESP32';
    
    Logger.log('Opening sheet with ID: ' + sheetId);
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log('ERROR: Sheet not found!');
      return;
    }
    
    Logger.log('Sheet found successfully!');
    Logger.log('Current row count: ' + sheet.getLastRow());
    
    // Add test data using real port locations
    const testRow = [
      '2025-09-26',
      'Mauban Port',        // Origin (departure port)
      'Cagbalete Port',     // Destination (arrival port) 
      'TEST_BOAT',
      '14:30:00',          // Arrival Time
      '08:00:00'           // Departure Time
    ];
    
    sheet.appendRow(testRow);
    Logger.log('Test row added successfully with real port names!');
    Logger.log('New row count: ' + sheet.getLastRow());
    
  } catch (error) {
    Logger.log('ERROR in simple test: ' + error.toString());
  }
}