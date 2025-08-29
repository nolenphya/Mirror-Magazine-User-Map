// Mapbox Setup

mapboxgl.accessToken = 'pkpk.eyJ1Ijoibm9sZW5waHlhIiwiYSI6ImNtOGk3bXB1MzBhM2Qyc292ZjZrZ2tjMHMifQ.ZItrPCguE2g3w99InSdzLQ';
const map = new mapboxgl.Map({
  container: 'map',
 style: 'mapbox://styles/nolenphya/cm8hobpgo00u101s5d3ebdjdz',
  center: [-73.94, 40.73],
  zoom: 11
});


// Airtable Setup
const AIRTABLE_API_KEY = 'patqigUJTp4x0eHMj.aa9a269d3feac521966920e2a927b43598703dbf7d7d11c67a15ac708c6b5a77';
const BASE_ID = 'appeZ9qxsOgKiYPaJ';
const TABLE_NAME = 'tblHguVMJF1GNv56H';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;



// Fetch data
async function fetchData() {
  const res = await fetch(`${AIRTABLE_URL}?view=Grid%20view&filterByFormula=Approved`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
  });

  const json = await res.json();
  const rawRecords = json.records.map(rec => ({ id: rec.id, ...rec.fields }));

  const enrichedRecords = await Promise.all(
    rawRecords.map(async (record) => {
      const hasLatLng = parseFloat(record.Latitude) && parseFloat(record.Longitude);
      return hasLatLng ? record : await geocodeAndSaveMissingCoords(record);
    })
  );

  createMarkers(enrichedRecords.filter(Boolean));
}

// Geocode missing
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

// Create markers + build legend + build searchable directory
// Utility: white → black gradient
function getGradientColor(index, total) {
  const t = total > 1 ? index / (total - 1) : 0; // 0 → 1
  const shade = Math.round(255 * (1 - t));       // 255=white, 0=black
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


function createMarkers(data) {
  allMarkers.forEach(m => m.remove());
  allMarkers = [];

  // Use "Name" field as category
  const uniqueNames = [...new Set(data.map(row => row.Name).filter(Boolean))];
  const colorMap = assignStableGradientColors(uniqueNames);
  uniqueNames.forEach((name, i) => {
    colorMap[name] = getGradientColor(i, uniqueNames.length);
  });

  const tagGroups = {};
  const groupedOptions = {};

  data.forEach((row, index) => {
    const lat = parseFloat(row.Latitude);
    const lng = parseFloat(row.Longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const category = row.Name || "Uncategorized";
    const color = colorMap[category] || "#000";

    // Create a circular colored marker
    const el = document.createElement('div');
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = color;
    el.style.border = '2px solid #fff';
    el.style.boxShadow = '0 0 4px rgba(0,0,0,0.3)';
    el.style.cursor = 'pointer';

    // Label on hover / zoom
    const label = document.createElement('div');
    label.className = 'marker-label';
    label.innerText = row["Org Name"] || category;
    label.style.position = 'absolute';
    label.style.top = '24px';
    label.style.left = '50%';
    label.style.transform = 'translateX(-50%)';
    label.style.whiteSpace = 'nowrap';
    label.style.backgroundColor = 'rgba(255,255,255,0.8)';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '4px';
    label.style.fontSize = '12px';
    label.style.display = 'none';

    el.appendChild(label);

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="max-width: 250px;">
        <h3>${row["Org Name"] || category}</h3>
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

    // Group markers by Name
    if (!tagGroups[category]) tagGroups[category] = [];
    tagGroups[category].push(marker);

    if (!groupedOptions[category]) groupedOptions[category] = [];
    groupedOptions[category].push({ label: row["Org Name"] || category, index });
  });

  buildLegend(tagGroups, colorMap);
}

map.on('zoom', () => {
  const zoomLevel = map.getZoom();
  allMarkers.forEach(marker => {
    if (marker.labelElement) {
      marker.labelElement.style.display = zoomLevel >= 14 ? 'block' : 'none';
    }
  });
});


document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim().toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = ''; // Clear old results

    if (!query) return;

    const matches = allMarkers.filter(marker => {
      const name = (marker.rowData["Org Name"] || "").toLowerCase();
      const tags = (marker.rowData.Tags || "").toLowerCase();
      return name.includes(query) || tags.includes(query);
    });

    if (matches.length === 0) {
      resultsContainer.innerHTML = '<p>No matches found.</p>';
      return;
    }

    // Optional: Zoom to first match
    const first = matches[0];
    map.flyTo({ center: first.getLngLat(), zoom: 14, essential: true });
    first.togglePopup();

    // Show results
    const list = document.createElement('ul');
    list.style.padding = '0';
    list.style.listStyle = 'none';

    matches.forEach(marker => {
      const li = document.createElement('li');
      li.style.marginBottom = '6px';

      const link = document.createElement('a');
      link.href = '#';
      link.textContent = marker.rowData["Org Name"] || "Unnamed";
      link.style.textDecoration = 'underline';
      link.style.color = '#007bff';
      link.addEventListener('click', (ev) => {
        ev.preventDefault();
        map.flyTo({ center: marker.getLngLat(), zoom: 15, essential: true });
        marker.togglePopup();
      });

      li.appendChild(link);
      list.appendChild(li);
    });

    resultsContainer.appendChild(list);
  }
});

document.getElementById('search-input').addEventListener('input', (e) => {
  const query = e.target.value.trim().toLowerCase();
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = ''; // Clear previous results

  if (!query) return;

  const matches = allMarkers.filter(marker => {
    const name = (marker.rowData["Org Name"] || "").toLowerCase();
    const tags = (marker.rowData.Tags || "").toLowerCase();
    return name.includes(query) || tags.includes(query);
  });

  if (matches.length === 0) {
    resultsContainer.innerHTML = '<p>No matches found.</p>';
    return;
  }

  const list = document.createElement('ul');
  list.style.padding = '0';
  list.style.listStyle = 'none';

  matches.forEach(marker => {
    const li = document.createElement('li');
    li.style.marginBottom = '6px';

    const link = document.createElement('a');
    link.href = '#';
    link.textContent = marker.rowData["Org Name"] || "Unnamed";
    link.style.textDecoration = 'underline';
    link.style.color = '#007bff';

    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      map.flyTo({ center: marker.getLngLat(), zoom: 15, essential: true });
      marker.togglePopup();
    });

    li.appendChild(link);
    list.appendChild(li);
  });

  resultsContainer.appendChild(list);
});





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

      markers.sort((a, b) => {
        const nameA = (a.rowData["Org Name"] || "").toLowerCase();
        const nameB = (b.rowData["Org Name"] || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

      markers.forEach(marker => {
        const li = document.createElement('li');

        const swatch = document.createElement('span');
        swatch.style.display = 'inline-block';
        swatch.style.width = '16px';
        swatch.style.height = '16px';
        swatch.style.marginRight = '6px';
        swatch.style.backgroundColor = colorMap[tag] || '#000';

        const label = document.createElement('span');
        label.textContent = marker.rowData["Org Name"] || "Unnamed";
        label.style.cursor = 'pointer';
        label.style.textDecoration = 'underline';

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

        li.appendChild(checkbox);
        li.appendChild(swatch);
        li.appendChild(label);
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

      section.appendChild(header);
      section.appendChild(list);
      container.appendChild(section);
    });
}


document.getElementById('reset-legend').addEventListener('click', () => {
  // Check all checkboxes
  document.querySelectorAll('.legend-org-list input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = true;
  });

  // Show all markers
  allMarkers.forEach(marker => {
    marker.getElement().style.display = 'block';
  });
});


// Map load


map.on('load', () => {
    // Show info box by default when map loads
    document.getElementById('map-guide-overlay').style.visibility = 'visible';

  Object.values(iconMap).forEach(iconName => {
    map.loadImage(`icons/${iconName}.png`, (error, image) => {
      if (error) {
        console.warn(`Could not load icon "${iconName}":`, error);
      } else if (!map.hasImage(iconName)) {
        map.addImage(iconName, image);
      }
    });
  });

  fetchData();

  map.addSource('subway-lines', {
    type: 'geojson',
    data: 'nyc-subway-routes.geojson'
  });

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

  map.addSource('subway-stops', {
    type: 'geojson',
    data: 'nyc-subway-stops.geojson'
  });

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

// UI toggle logic
map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

// Hide by default
document.getElementById('map-guide-overlay').style.display = 'none';

// When intro is closed, show the info box
document.getElementById('close-intro').addEventListener('click', () => {
  document.getElementById('intro-overlay').style.display = 'none';
  document.getElementById('map-guide-overlay').style.display = 'flex';
});


const intro = document.getElementById('intro-overlay');
intro.addEventListener('touchmove', (e) => {
  if (intro.scrollTop > 100) {
    intro.style.display = 'none';
  }
});



document.addEventListener('DOMContentLoaded', () => {
  const legendPanel = document.getElementById('legend-panel');
const legendToggle = document.getElementById('legend-toggle');

legendToggle.addEventListener('click', () => {
  legendPanel.classList.toggle('collapsed');
  legendToggle.textContent = legendPanel.classList.contains('collapsed') ? 'Show' : 'Hide';
});
})

document.addEventListener('DOMContentLoaded', () => {
  const mapGuideOverlay = document.getElementById('map-guide-overlay');
  const mapGuideClose = document.getElementById('map-guide-close');
  const infoButton = document.getElementById('info-button');

  // Open
  if (infoButton) {
    infoButton.addEventListener('click', () => {
      mapGuideOverlay.style.display = 'flex';
    });
  }

  // Close
  if (mapGuideClose) {
    mapGuideClose.addEventListener('click', () => {
      mapGuideOverlay.style.display = 'none';
    });
  }
});


const legendPanel = document.getElementById('legend-panel');
const legendHeader = legendPanel.querySelector('.legend-header');

legendHeader.addEventListener('click', () => {
  legendPanel.classList.toggle('expanded');
});

document.addEventListener('click', (e) => {
  const legendPanel = document.getElementById('legend-panel');
  if (legendPanel.classList.contains('expanded') && !legendPanel.contains(e.target)) {
    legendPanel.classList.remove('expanded');
  }
}); 