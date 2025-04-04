// ✅ Step 1: Initialize the Mapbox map
mapboxgl.accessToken = 'pk.eyJ1Ijoibm9sZW5waHlhIiwiYSI6ImNtOGk3bXB1MzBhM2Qyc292ZjZrZ2tjMHMifQ.ZItrPCguE2g3w99InSdzLQ';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/nolenphya/cm8hobpgo00u101s5d3ebdjdz',
  center: [-74.006, 40.7128],
  zoom: 10
});

// Add the geocoder (autocomplete search box) to the map
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  placeholder: 'Search for an address',
  marker: { color: 'red' },
  proximity: {
    longitude: -74.006,
    latitude: 40.7128
  },
  countries: 'us',
  limit: 5
});
map.addControl(geocoder);

// Optionally, listen for the result event
geocoder.on('result', function(e) {
  console.log('Selected location:', e.result);
});

// ✅ Step 2: Fetch and parse CSV using Papa Parse (unchanged)
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
let allMarkers = [];

function addMarkers(data) {
  allMarkers.forEach(marker => marker.remove());
  allMarkers = [];

  data.forEach(row => {
    if (!row.Longitude || !row.Latitude || !row.PhotoURL) {
      console.warn("Skipping row with missing data:", row);
      return;
    }

    const popupContent = `
      <div style="max-width: 300px;">
        <img src="${row.PhotoURL}" 
             alt="User Photo" 
             style="width:100%; max-height:250px; object-fit:cover; border-radius:8px;" />
        <h3>${row.Name || 'Anonymous'}</h3>
        <p><b>Age:</b> ${row.Age || 'N/A'}</p>
        <p><b>Social Media:</b> ${row.Social || 'N/A'}</p>
        <p><b>Photography Experience:</b> ${row.Experience || 'N/A'}</p>
        <p><b>Description:</b> ${row.Description || 'N/A'}</p>
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent);

    const marker = new mapboxgl.Marker({ color: 'yellow' })
      .setLngLat([parseFloat(row.Longitude), parseFloat(row.Latitude)])
      .setPopup(popup)
      .addTo(map);

    marker.rowData = row;
    allMarkers.push(marker);
  });
}

// ✅ Step 4: Start fetching data
map.on('load', fetchData);
