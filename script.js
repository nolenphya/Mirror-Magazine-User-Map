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
let allMarkers = []; // Declare this at the global level

const artistGroups = {}; // Artist name → list of markers

function addMarkers(data) {
  allMarkers.forEach(marker => marker.remove());
  allMarkers = [];

  data.forEach(row => {
    if (!row.Longitude || !row.Latitude) return;

    const marker = new mapboxgl.Marker({ color: 'white' })
      .setLngLat([parseFloat(row.Longitude), parseFloat(row.Latitude)])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(/* your popup HTML here */)
      )
      .addTo(map);

    marker.rowData = row;
    allMarkers.push(marker);

    const artist = row.Name || 'Anonymous';

    if (!artistGroups[artist]) {
      artistGroups[artist] = [];
    }

    artistGroups[artist].push(marker);
  });

  buildLegend();
}

// Add Legend

function buildLegend() {
  const legendContainer = document.getElementById('legend');
  legendContainer.innerHTML = ''; // Clear existing

  Object.keys(artistGroups).forEach(artist => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.textContent = artist;
    item.dataset.visible = 'true';

    item.onclick = () => {
      const visible = item.dataset.visible === 'true';
      item.dataset.visible = !visible;
      item.classList.toggle('hidden');

      artistGroups[artist].forEach(marker => {
        marker.getElement().style.display = visible ? 'none' : 'block';
      });
    };

    legendContainer.appendChild(item);
  });
}

// ✅ Step 4: Start fetching data
map.on('load', fetchData);
