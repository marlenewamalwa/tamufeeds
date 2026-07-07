// ============================================================
// Map module — Leaflet view of listings, color-coded by status
// ============================================================

const NAIROBI_CENTER = [-1.286389, 36.817223];

const STATUS_COLOR = {
  available: '#2f9e44', // green
  claimed: '#f0a800',   // amber
  completed: '#adb5bd', // grey
  expired: '#e03131'    // red
};

let map = null;
let markersLayer = null;
let mapListings = [];
let legendWired = false;

// Which statuses are currently shown on the map. Starts as "all" (every key active).
let activeStatuses = new Set(Object.keys(STATUS_COLOR));

function initMap() {
  if (map) return; // already initialized, just needs refreshMap() to redraw markers

  map = L.map('map-container').setView(NAIROBI_CENTER, 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

// Wires up the legend chips as clickable status filters. Click a chip to isolate
// that status; click the same chip again (when it's the only one active) to
// restore showing every status. Only needs to run once.
function initMapLegend() {
  if (legendWired) return;
  legendWired = true;

  document.querySelectorAll('.map-legend-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const status = chip.dataset.status;
      const isSoloActive = activeStatuses.size === 1 && activeStatuses.has(status);

      activeStatuses = isSoloActive
        ? new Set(Object.keys(STATUS_COLOR))
        : new Set([status]);

      updateLegendUI();
      renderMapMarkers();
    });
  });
}

function updateLegendUI() {
  document.querySelectorAll('.map-legend-chip').forEach(chip => {
    chip.classList.toggle('active', activeStatuses.has(chip.dataset.status));
  });
}

async function refreshMap() {
  initMap();
  initMapLegend();

  // Leaflet needs a nudge to size correctly if the container was hidden (display:none) on init
  setTimeout(() => map.invalidateSize(), 0);

  await Listings.fetchAll();
  mapListings = Listings.cache;
  renderMapMarkers();
}

// Redraws markers from the current mapListings cache, applying the active legend filter.
// Called on refresh and whenever a legend chip is clicked (no refetch needed).
function renderMapMarkers() {
  if (!markersLayer) return;
  markersLayer.clearLayers();

  const withCoords = mapListings.filter(l => l.lat != null && l.lng != null);
  const visible = withCoords.filter(l => activeStatuses.has(l.status));

  const note = document.getElementById('map-note');
  if (note) {
    const missing = mapListings.length - withCoords.length;
    const filteredOut = withCoords.length - visible.length;
    let text = `${visible.length} listing(s) plotted.`;
    if (filteredOut > 0) text += ` ${filteredOut} hidden by filter.`;
    if (missing > 0) text += ` ${missing} listing(s) have no map location yet.`;
    note.textContent = text;
  }

  visible.forEach(l => {
    const color = STATUS_COLOR[l.status] || STATUS_COLOR.available;
    const marker = L.circleMarker([l.lat, l.lng], {
      radius: 9,
      color: '#fff',
      weight: 2,
      fillColor: color,
      fillOpacity: 0.9
    });

    const claim = Listings.activeClaim(l);
    const restaurantName = l.restaurant?.org_name || 'Unknown restaurant';
    const claimedBy = claim?.ngo?.org_name ? `<br><strong>Claimed by:</strong> ${escapeHtml(claim.ngo.org_name)}` : '';

    marker.bindPopup(`
      <strong>${escapeHtml(l.food_item)}</strong><br>
      ${escapeHtml(restaurantName)}<br>
      <strong>Quantity:</strong> ${escapeHtml(l.quantity)}<br>
      <strong>Location:</strong> ${escapeHtml(l.location)}<br>
      <strong>Status:</strong> ${escapeHtml(l.status)}
      ${claimedBy}
    `);

    marker.addTo(markersLayer);
  });

  if (visible.length) {
    const bounds = L.latLngBounds(visible.map(l => [l.lat, l.lng]));
    map.fitBounds(bounds.pad(0.2));
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}