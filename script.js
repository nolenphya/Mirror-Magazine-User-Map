// ✅ Step 1: Initialize the Mapbox map
mapboxgl.accessToken = 'pk.eyJ1Ijoibm9sZW5waHlhIiwiYSI6ImNtOGk3bXB1MzBhM2Qyc292ZjZrZ2tjMHMifQ.ZItrPCguE2g3w99InSdzLQ';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/nolenphya/cm8hobpgo00u101s5d3ebdjdz',
  center: [-74.006, 40.7128],
  zoom: 10
});

// Initialize the geocoder control
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken, // your Mapbox access token
  mapboxgl: mapboxgl,                // mapbox-gl instance
  placeholder: 'Search for an address', // placeholder text in the search box
  marker: { color: 'red' }           // optional: customize the marker for the search result
});

// Add the geocoder to the map (default position is top-right)
// Alternatively, you can specify a container by using the 'container' option.
map.addControl(geocoder);


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
let allMarkers = []; // Store all markers for easy filtering

// ✅ Modify the addMarkers function to store markers
function addMarkers(data) {
  allMarkers.forEach(marker => marker.remove()); // Clear old markers if any
  allMarkers = [];

  data.forEach(row => {
    if (!row.Longitude || !row.Latitude || !row.PhotoURL) {
      console.warn("Skipping row with missing data:", row);
      return;
    }

    // Create a popup with a photo and user details
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

    // ✅ Store marker in a variable
    const marker = new mapboxgl.Marker({ color: 'yellow' })
      .setLngLat([parseFloat(row.Longitude), parseFloat(row.Latitude)])
      .setPopup(popup)
      .addTo(map);

    marker.rowData = row; // ✅ Store row data for easy access during search
    allMarkers.push(marker); // ✅ Save marker for filtering
  });
}


// ✅ Perform search based on user input
function performSearch() {
  const query = document.getElementById('search-box').value.toLowerCase().trim();

  allMarkers.forEach(marker => {
    const data = marker.rowData;

// ✅ Perform this function to clear the map filter
    function clearSearch() {
      document.getElementById('search-box').value = ''; // Clear input field
      allMarkers.forEach(marker => {
        marker.getElement().style.display = 'block'; // Show all markers
      });
    }
    

    // Check if any field matches the search query
    const matches = 
      (data.Name && data.Name.toLowerCase().includes(query)) ||
      (data.Social && data.Social.toLowerCase().includes(query)) ||
      (data.Experience && data.Experience.toLowerCase().includes(query));

    if (matches) {
      marker.getElement().style.display = 'block'; // Show marker
    } else {
      marker.getElement().style.display = 'none'; // Hide marker
    }
  });
}

function searchAddress() {
  const query = document.getElementById('search-box').value.trim();

  if (!query) {
    alert("Please enter an address!");
    return;
  }

  // Mapbox Geocoding API URL
  const geocodeURL = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}`;

  fetch(geocodeURL)
    .then(response => response.json())
    .then(data => {
      if (data.features.length === 0) {
        alert("Location not found. Try again.");
        return;
      }

      // Get the first result
      const place = data.features[0];
      const [lng, lat] = place.center; // Extract coordinates

      // Move the map to the new location
      map.flyTo({
        center: [lng, lat],
        zoom: 14
      });

      // Optional: Add a marker at the searched location
      if (searchMarker) searchMarker.remove(); // Remove old search marker if any

      searchMarker = new mapboxgl.Marker({ color: "red" })
        .setLngLat([lng, lat])
        .addTo(map);
    })
    .catch(error => {
      console.error("Geocoding error:", error);
      alert("Error searching address. Try again later.");
    });
}

// Store the search marker so we can remove it later
let searchMarker = null;


// ✅ Step 4: Start fetching data
map.on('load', fetchData);
