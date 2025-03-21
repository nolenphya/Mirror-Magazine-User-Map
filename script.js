// ✅ Step 1: Initialize the Mapbox map
mapboxgl.accessToken = 'pk.eyJ1Ijoibm9sZW5waHlhIiwiYSI6ImNtOGk3bXB1MzBhM2Qyc292ZjZrZ2tjMHMifQ.ZItrPCguE2g3w99InSdzLQ';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/nolenphya/cm8hiwpmi00i001rydvfe58w5',
  center: [-74.006, 40.7128], // Default to NYC, adjust as needed
  zoom: 10
});

// ✅ Step 2: Fetch and parse CSV using Papa Parse
function fetchData() {
  const sheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTAs2iJ6rHmqMhaqBpJ_qQlASegC-to4WoI_FKhv_twq-eG5Q9M-ZJi19emt32AQUx592l9vm-Asz6n/pub?gid=216285315&single=true&output=csv';
  
  fetch(sheetURL)
    .then(response => response.text())
    .then(csvData => {
      Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          console.log("Parsed Data:", results.data);
          addMarkers(results.data);
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
        }
      });
    })
    .catch(error => console.error("Failed to fetch CSV:", error));
}

// ✅ Step 3: Add markers to the map
function addMarkers(data) {
  data.forEach(row => {
    // Ensure data has necessary fields
    if (!row.Longitude || !row.Latitude) {
      console.warn("Skipping row with missing coordinates:", row);
      return;
    }

    // Create a popup with the data from the spreadsheet
    const popup = new mapboxgl.Popup({ offset: 25 })
      .setHTML(`
        <h3>${row.Name || 'Unnamed Location'}</h3>
        <p><b>Address:</b> ${row.Address || 'N/A'}</p>
        <p><b>Phone:</b> ${row.Phone || 'N/A'}</p>
      `);

    // Create a marker
    new mapboxgl.Marker({ color: 'purple' })
      .setLngLat([parseFloat(row.Longitude), parseFloat(row.Latitude)])
      .setPopup(popup)
      .addTo(map);
  });
}

// ✅ Step 4: Start fetching data
map.on('load', fetchData);
