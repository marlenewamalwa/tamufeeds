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

function initMap() {
  if (map) return; // already initialized, just needs refreshMap() to redraw markers

  map = L.map('map-container').setView(NAIROBI_CENTER, 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

async function refreshMap() {
  initMap();

  // Leaflet needs a nudge to size correctly if the container was hidden (display:none) on init
  setTimeout(() => map.invalidateSize(), 0);

  await Listings.fetchAll();
  const listings = Listings.cache;

  markersLayer.clearLayers();

  const note = document.getElementById('map-note');
  const withCoords = listings.filter(l => l.lat != null && l.lng != null);

  if (note) {
    const missing = listings.length - withCoords.length;
    note.textContent = missing > 0
      ? `${withCoords.length} listing(s) plotted. ${missing} listing(s) have no map location yet.`
      : `${withCoords.length} listing(s) plotted.`;
  }

  withCoords.forEach(l => {
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

  if (withCoords.length) {
    const bounds = L.latLngBounds(withCoords.map(l => [l.lat, l.lng]));
    map.fitBounds(bounds.pad(0.2));
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}