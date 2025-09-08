// =======================
// Mapbox Setup
// =======================
mapboxgl.accessToken = 'pk.eyJ1Ijoibm9sZW5waHlhIiwiYSI6ImNtOGk3bXB1MzBhM2Qyc292ZjZrZ2tjMHMifQ.ZItrPCguE2g3w99InSdzLQ';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/nolenphya/cm8hobpgo00u101s5d3ebdjdz',
  center: [-73.94, 40.73],
  zoom: 11
});

// Global vars
let allMarkers = [];
const iconMap = {}; // Add your custom icon mapping if needed

// =======================
// Airtable Setup
// =======================
const AIRTABLE_API_KEY = 'patsJ1rBKasjE6bSA.85dddd2552b8c0809bdad2f53e347e704b53ffa963435daa9bfc93d4c1adcb14';
const BASE_ID = 'appeZ9qxsOgKiYPaJ';
const TABLE_NAME = encodeURIComponent('Mirror Magazine IBX Project');
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

// =======================
// Utility Functions
// =======================
function getGradientColor(index, total) {
  const t = total > 1 ? index / (total - 1) : 0;
  const shade = Math.round(255 * (1 - t));
  return `rgb(${shade},${shade},${shade})`;
}

function assignStableGradientColors(names) {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  const map = {};
  sorted.forEach((name, i) => {
    map[name] = getGradientColor(i, sorted.length);
  });
  return map;
}

// =======================
// Data Fetching
// =======================
async function fetchData() {
  const AIRTABLE_URL = "https://api.airtable.com/v0/YOUR_BASE_ID/YOUR_TABLE_NAME";
  const AIRTABLE_API_KEY = "YOUR_API_KEY";

  // Use filterByFormula correctly - adjust the formula for your actual field name
 const filterFormula = encodeURIComponent("{Approved}=TRUE()");
  const viewName = encodeURIComponent("main");

  const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?view=${viewName}&filterByFormula=${filterFormula}`;


  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Airtable Error (${res.status}):`, errorText);
      return [];
    }

    const data = await res.json();
    return data.records || [];

  } catch (err) {
    console.error("Fetch failed:", err);
    return [];
  }
}


async function geocodeAndSaveMissingCoords(record) {
  if (!record.Address) return null;

  const query = encodeURIComponent(record.Address);
  const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxgl.accessToken}`;

  try {
    const res = await fetch(geocodeUrl);
    const json = await res.json();
    if (!json.features.length) return null;

    const [lng, lat] = json.features[0].center;

    await fetch(`${AIRTABLE_URL}/${record.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: { Latitude: lat, Longitude: lng } })
    });

    record.Latitude = lat;
    record.Longitude = lng;
    return record;
  } catch (error) {
    console.error('Geocoding failed:', record.Address, error);
    return null;
  }
}

// =======================
// Marker Creation
// =======================
function createMarkers(data) {
  // Clear old markers
  allMarkers.forEach(m => m.remove());
  allMarkers = [];

  const uniqueNames = [...new Set(data.map(row => row.Name).filter(Boolean))];
  const colorMap = assignStableGradientColors(uniqueNames);

  const tagGroups = {};
  const groupedOptions = {};

  data.forEach((row, index) => {
    const lat = parseFloat(row.Latitude);
    const lng = parseFloat(row.Longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const category = row.Name || "Uncategorized";
    const color = colorMap[category] || "#000";

    // Marker element
    const el = document.createElement('div');
    el.className = 'marker';
    Object.assign(el.style, {
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      backgroundColor: color,
      border: '2px solid #fff',
      boxShadow: '0 0 4px rgba(0,0,0,0.3)',
      cursor: 'pointer'
    });

    // Label
    const label = document.createElement('div');
    label.className = 'marker-label';
    label.innerText = row["Name"] || category;
    Object.assign(label.style, {
      position: 'absolute',
      top: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      whiteSpace: 'nowrap',
      backgroundColor: 'rgba(255,255,255,0.8)',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '12px',
      display: 'none'
    });

    el.appendChild(label);

    // Popup
    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="max-width: 250px;">
        <h3>${row["Name"] || category}</h3>
        ${row.Description ? `<p>${row.Description}</p>` : ''}
        ${row.Address ? `<p><b>Address:</b><br>${row.Address}</p>` : ''}
      </div>
    `);

    const marker = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(map);

    marker.labelElement = label;
    marker.rowData = row;
    allMarkers.push(marker);

    // Group by category
    if (!tagGroups[category]) tagGroups[category] = [];
    tagGroups[category].push(marker);

    if (!groupedOptions[category]) groupedOptions[category] = [];
    groupedOptions[category].push({ label: row["Name"] || category, index });
  });

  buildLegend(tagGroups, colorMap);
}

// =======================
// Legend & UI
// =======================
function buildLegend(tagGroups, colorMap) {
  const container = document.getElementById('legend-content');
  container.innerHTML = '';

  Object.entries(tagGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([tag, markers]) => {
      const section = document.createElement('div');
      section.className = 'legend-category';

      const header = document.createElement('h4');
      header.innerHTML = `<span class="arrow">▾</span> ${tag}`;
      header.style.cursor = 'pointer';

      const list = document.createElement('ul');
      list.className = 'legend-org-list';
      list.style.display = 'block';

      markers.sort((a, b) =>
        (a.rowData["Name"] || "").toLowerCase().localeCompare((b.rowData["Name"] || "").toLowerCase())
      );

      markers.forEach(marker => {
        const li = document.createElement('li');

        const swatch = document.createElement('span');
        Object.assign(swatch.style, {
          display: 'inline-block',
          width: '16px',
          height: '16px',
          marginRight: '6px',
          backgroundColor: colorMap[tag] || '#000'
        });

        const label = document.createElement('span');
        label.textContent = marker.rowData["Name"] || "Unnamed";
        Object.assign(label.style, { cursor: 'pointer', textDecoration: 'underline' });
        label.addEventListener('click', () => {
          map.flyTo({ center: marker.getLngLat(), zoom: 15, essential: true });
          marker.togglePopup();
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.addEventListener('change', () => {
          marker.getElement().style.display = checkbox.checked ? 'block' : 'none';
        });

        li.append(checkbox, swatch, label);
        list.appendChild(li);
      });

      header.addEventListener('click', () => {
        const collapsed = list.style.display === 'none';
        list.style.display = collapsed ? 'block' : 'none';
        header.querySelector('.arrow').textContent = collapsed ? '▾' : '▸';
        markers.forEach(marker => {
          marker.getElement().style.display = collapsed ? 'block' : 'none';
        });
      });

      section.append(header, list);
      container.appendChild(section);
    });
}

// =======================
// Map Event Listeners
// =======================
map.on('zoom', () => {
  const zoomLevel = map.getZoom();
  allMarkers.forEach(marker => {
    if (marker.labelElement) {
      marker.labelElement.style.display = zoomLevel >= 14 ? 'block' : 'none';
    }
  });
});

map.on('load', () => {
  // Load icons if defined
  Object.values(iconMap).forEach(iconName => {
    map.loadImage(`icons/${iconName}.png`, (error, image) => {
      if (error) {
        console.warn(`Could not load icon "${iconName}":`, error);
      } else if (!map.hasImage(iconName)) {
        map.addImage(iconName, image);
      }
    });
  });

  // Fetch data
  fetchData();

  // Subway layers
  map.addSource('subway-lines', { type: 'geojson', data: 'nyc-subway-routes.geojson' });
  map.addLayer({
    id: 'subway-lines-layer',
    type: 'line',
    source: 'subway-lines',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-width': 2,
      'line-color': [
        'match',
        ['get', 'rt_symbol'],
        '1', '#EE352E', '2', '#EE352E', '3', '#EE352E',
        '4', '#00933C', '5', '#00933C', '6', '#00933C',
        'A', '#2850AD', 'C', '#2850AD', 'E', '#2850AD',
        'B', '#FF6319', 'D', '#FF6319', 'F', '#FF6319', 'M', '#FF6319',
        'N', '#FCCC0A', 'Q', '#FCCC0A', 'R', '#FCCC0A', 'W', '#FCCC0A',
        'L', '#A7A9AC', 'G', '#6CBE45', 'J', '#996633', 'Z', '#996633',
        '7', '#B933AD',
        '#000000'
      ]
    }
  });

  map.addSource('subway-stops', { type: 'geojson', data: 'nyc-subway-stops.geojson' });
  map.addLayer({
    id: 'subway-stations-stops',
    type: 'circle',
    source: 'subway-stops',
    paint: {
      'circle-radius': 1,
      'circle-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#000000'
    }
  });
});

// =======================
// UI Controls
// =======================
map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

// Toggle legend
const legendPanel = document.getElementById('legend-panel');
const legendToggle = document.getElementById('legend-toggle');
legendToggle.addEventListener('click', () => {
  legendPanel.classList.toggle('collapsed');
  legendToggle.textContent = legendPanel.classList.contains('collapsed') ? 'Show' : 'Hide';
});

// Reset legend
document.getElementById('reset-legend').addEventListener('click', () => {
  document.querySelectorAll('.legend-org-list input[type="checkbox"]').forEach(cb => cb.checked = true);
  allMarkers.forEach(marker => marker.getElement().style.display = 'block');
});

// Info overlay
const mapGuideOverlay = document.getElementById('map-guide-overlay');
const mapGuideClose = document.getElementById('map-guide-close');
const infoButton = document.getElementById('info-button');

if (infoButton) {
  infoButton.addEventListener('click', () => mapGuideOverlay.style.display = 'flex');
}
if (mapGuideClose) {
  mapGuideClose.addEventListener('click', () => mapGuideOverlay.style.display = 'none');
}

// Intro overlay
document.getElementById('close-intro').addEventListener('click', () => {
  document.getElementById('intro-overlay').style.display = 'none';
  mapGuideOverlay.style.display = 'flex';
});