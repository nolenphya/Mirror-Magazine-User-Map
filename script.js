// =======================
// Mapbox Setup
// =======================
mapboxgl.accessToken = 'pk.eyJ1Ijoibm9sZW5waHlhIiwiYSI6ImNtZmJ5N2o2cjByeGcybHBvcWgyeHpuZjYifQ.e1T0G8En--8IQLxLxriS2Q';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/nolenphya/cm8hobpgo00u101s5d3ebdjdz',
  center: [-73.94, 40.73],
  zoom: 11
});

// Add mapbox geolocation control
const geolocate = new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true,
  showUserHeading: true
});

map.addControl(geolocate, 'bottom-right');

map.on('load', () => {
  geolocate.trigger(); 
});

let allMarkers = [];
const iconMap = {};

// =======================
// Airtable Setup
// =======================
const AIRTABLE_API_KEY = 'patsJ1rBKasjE6bSA.85dddd2552b8c0809bdad2f53e347e704b53ffa963435daa9bfc93d4c1adcb14';
const BASE_ID = 'appeZ9qxsOgKiYPaJ';
const TABLE_NAME = 'tblHguVMJF1GNv56H';
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
  const filterFormula = encodeURIComponent("{Approved}=TRUE()");
  const viewName = encodeURIComponent("main");
  let allRecords = [];
  let offset = null;

  try {
    do {
      const fetchUrl = `${AIRTABLE_URL}?view=${viewName}&filterByFormula=${filterFormula}${
        offset ? `&offset=${offset}` : ""
      }`;

      const res = await fetch(fetchUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Airtable Error (${res.status}):`, errorText);
        return allRecords;
      }

      const data = await res.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);

    return allRecords;
  } catch (err) {
    console.error("Fetch failed:", err);
    return allRecords;
  }
}

// =======================
// Marker Creation
// =======================
function createMarkers(data) {
  allMarkers.forEach(m => m.remove());
  allMarkers = [];

  const uniqueNames = [...new Set(data.map(row => row.Name).filter(Boolean))];
  const colorMap = assignStableGradientColors(uniqueNames);
  const tagGroups = {};

  data.forEach((row, index) => {
    const lat = parseFloat(row.Latitude);
    const lng = parseFloat(row.Longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const category = row.Name || "Uncategorized";
    const color = colorMap[category] || "#000";

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

    if (!tagGroups[category]) tagGroups[category] = [];
    tagGroups[category].push(marker);
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
// Photo Contribution Modal & EXIF Logic
// =======================
const contributeModal = document.getElementById('contribute-modal');
const openModalBtn = document.getElementById('open-contribute-modal');
const closeModalBtn = document.getElementById('close-contribute-modal');
const cancelContributeBtn = document.getElementById('cancel-contribute');

if (openModalBtn) openModalBtn.addEventListener('click', () => contributeModal.style.display = 'flex');
if (closeModalBtn) closeModalBtn.addEventListener('click', () => contributeModal.style.display = 'none');
if (cancelContributeBtn) cancelContributeBtn.addEventListener('click', () => contributeModal.style.display = 'none');

// EXIF Reader
const fileInput = document.getElementById('photoFile');
const exifStatus = document.getElementById('exifStatus');
const latInput = document.getElementById('latitude');
const lonInput = document.getElementById('longitude');
const cameraInput = document.getElementById('camera');

if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      exifStatus.textContent = "Reading EXIF metadata...";
      const exifData = await exifr.parse(file, { tiff: true, gps: true });
      
      if (exifData) {
        if (exifData.latitude && exifData.longitude) {
          latInput.value = exifData.latitude;
          lonInput.value = exifData.longitude;
          exifStatus.textContent = `Location extracted: ${exifData.latitude.toFixed(4)}, ${exifData.longitude.toFixed(4)}`;
          exifStatus.className = "exif-status success";
        } else {
          exifStatus.textContent = "Photo loaded (No GPS metadata found in file). Use address autofill.";
          exifStatus.className = "exif-status warning";
        }

        const make = exifData.Make ? exifData.Make.trim() : '';
        const model = exifData.Model ? exifData.Model.trim() : '';
        if (make || model) {
          cameraInput.value = `${make} ${model}`.trim();
        }
      } else {
        exifStatus.textContent = "No EXIF metadata found.";
        exifStatus.className = "exif-status";
      }
    } catch (err) {
      console.error("Error parsing EXIF:", err);
      exifStatus.textContent = "Could not read image metadata.";
      exifStatus.className = "exif-status error";
    }
  });
}

// Form Submission Handler
const photoForm = document.getElementById('photoForm');
if (photoForm) {
  photoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = photoForm.querySelector('button[type="submit"]');
    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;

    try {
      const formData = new FormData();
      formData.append("photoFile", document.getElementById('photoFile').files[0]);
      formData.append("name", document.getElementById('name').value);
      formData.append("caption", document.getElementById('caption').value);
      formData.append("description", document.getElementById('description').value);
      formData.append("camera", document.getElementById('camera').value);
      formData.append("film", document.getElementById('film').value);
      formData.append("street", document.getElementById('street').value);
      formData.append("unit", document.getElementById('unit').value);
      formData.append("borough", document.getElementById('borough').value);
      formData.append("state", document.getElementById('state').value);
      formData.append("zipCode", document.getElementById('zipCode').value);
      formData.append("latitude", document.getElementById('latitude').value);
      formData.append("longitude", document.getElementById('longitude').value);

      // TODO: Replace with your deployed Cloudflare Worker URL
      const workerUrl = 'https://your-worker-subdomain.workers.dev';
      
      const response = await fetch(workerUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        alert("Photo submitted successfully! It is pending moderation review.");
        photoForm.reset();
        contributeModal.style.display = 'none';
      } else {
        alert(`Submission error: ${result.error}`);
      }
    } catch (err) {
      console.error("Submission failed:", err);
      alert("An error occurred during submission. Please try again.");
    } finally {
      submitBtn.textContent = "Submit to Archive";
      submitBtn.disabled = false;
    }
  });
}

// =======================
// Map Load & Events
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
  fetchData().then(records => {
    const data = records.map(r => ({
      id: r.id,
      ...r.fields
    }));
    createMarkers(data);
  });

  // Subway lines & stops layers...
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
});

// UI Controls
map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

const legendPanel = document.getElementById('legend-panel');
const legendToggle = document.getElementById('legend-toggle');
legendToggle.addEventListener('click', () => {
  legendPanel.classList.toggle('collapsed');
  legendToggle.textContent = legendPanel.classList.contains('collapsed') ? 'Show' : 'Hide';
});

document.getElementById('reset-legend').addEventListener('click', () => {
  document.querySelectorAll('.legend-org-list input[type="checkbox"]').forEach(cb => cb.checked = true);
  allMarkers.forEach(marker => marker.getElement().style.display = 'block');
});

const mapGuideOverlay = document.getElementById('map-guide-overlay');
const mapGuideClose = document.getElementById('map-guide-close');
const infoButton = document.getElementById('info-button');

if (infoButton) infoButton.addEventListener('click', () => mapGuideOverlay.style.display = 'flex');
if (mapGuideClose) mapGuideClose.addEventListener('click', () => mapGuideOverlay.style.display = 'none');
document.getElementById('close-intro').addEventListener('click', () => {
  document.getElementById('intro-overlay').style.display = 'none';
  mapGuideOverlay.style.display = 'flex';
});