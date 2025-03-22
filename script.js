// ✅ Step 1: Initialize the Mapbox map
mapboxgl.accessToken = 'pk.eyJ1Ijoibm9sZW5waHlhIiwiYSI6ImNtOGk3bXB1MzBhM2Qyc292ZjZrZ2tjMHMifQ.ZItrPCguE2g3w99InSdzLQ';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/nolenphya/cm8hiwpmi00i001rydvfe58w5',
  center: [-74.006, 40.7128],
  zoom: 10
});

// ✅ Step 2: Fetch and parse CSV using Papa Parse
function fetchData() {
  const sheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT9tYTUHZn_xeNv_blqO8x8RngTQ1Fg14tBbhhqPvJ-BfGPyE0O54jngg-pUjuTNzhpYR6WySwdM_cu/pub?gid=1517657781&single=true&output=csv';
  
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
    // Validate necessary data
    if (!row.Longitude || !row.Latitude || !row.PhotoURL) {
      console.warn("Skipping row with missing data:", row);
      return;
    }

    // Create a popup with a photo and user details
    const popupContent = `
      <div style="max-width: 300px;">
        <img src="${row.PhotoURL}" alt="User Photo" style="width:100%; border-radius:8px; margin-bottom:10px;">
        <h3>${row.FullName || 'Anonymous'}</h3>
        <p><b>Age:</b> ${row.Age || 'N/A'}</p>
        <p><b>Email:</b> ${row.Email || 'N/A'}</p>
        <p><b>Experience:</b> ${row.Experience || 'N/A'}</p>
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 25 })
      .setHTML(popupContent);

    // Create a marker
    new mapboxgl.Marker({ color: 'purple' })
      .setLngLat([parseFloat(row.Longitude), parseFloat(row.Latitude)])
      .setPopup(popup)
      .addTo(map);
  });
}

// ✅ Step 4: Start fetching data
map.on('load', fetchData);
