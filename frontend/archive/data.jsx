// Data utilities — route geometry is populated from the API via MockData.setupRoute().
// Removes all hardcoded mock data; only utility functions and map style definitions remain.

let PIPELINE_ROUTE = [];
let ROUTE_CUMKM = [0];
let TOTAL_KM = 0;
const PIN_BASE_KM = 42;

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function setupRoute(coords) {
  PIPELINE_ROUTE = coords; // [[lng, lat], ...]
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversineKm(coords[i - 1], coords[i]));
  }
  ROUTE_CUMKM = cum;
  TOTAL_KM = cum[cum.length - 1] || 0;
}

function coordAtKm(km) {
  if (!PIPELINE_ROUTE.length) return [0, 0];
  km = Math.max(0, Math.min(TOTAL_KM, km));
  for (let i = 1; i < ROUTE_CUMKM.length; i++) {
    if (ROUTE_CUMKM[i] >= km) {
      const t = (km - ROUTE_CUMKM[i - 1]) / (ROUTE_CUMKM[i] - ROUTE_CUMKM[i - 1] || 1);
      const a = PIPELINE_ROUTE[i - 1];
      const b = PIPELINE_ROUTE[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  return PIPELINE_ROUTE[PIPELINE_ROUTE.length - 1];
}

function snapToRoute(lng, lat) {
  if (!PIPELINE_ROUTE.length) return { lng, lat, km: 0 };
  let best = { dist: Infinity, lng: PIPELINE_ROUTE[0][0], lat: PIPELINE_ROUTE[0][1], km: 0 };
  for (let i = 1; i < PIPELINE_ROUTE.length; i++) {
    const a = PIPELINE_ROUTE[i - 1];
    const b = PIPELINE_ROUTE[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1e-12;
    let t = ((lng - a[0]) * dx + (lat - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dx, py = a[1] + t * dy;
    const ddx = lng - px, ddy = lat - py;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < best.dist) {
      const segKm = haversineKm(a, b);
      best = { dist: d2, lng: px, lat: py, km: ROUTE_CUMKM[i - 1] + t * segKm };
    }
  }
  return best;
}

// Map styles — URL key is updated after /config fetch
let _mapKey = "yWmb8yiKRTHxOjFuoso9"; // dev fallback

const MAP_STYLES = [
  {
    id: "satellite", label: "Satellite",
    get url() { return `https://api.maptiler.com/maps/hybrid/style.json?key=${_mapKey}`; },
    preview: "linear-gradient(135deg, #2d3a23 0%, #4a5d35 50%, #5a6d3f 100%)",
  },
  {
    id: "light", label: "Standard",
    get url() { return `https://api.maptiler.com/maps/streets-v2/style.json?key=${_mapKey}`; },
    preview: "linear-gradient(135deg, #f0f0eb 0%, #e0dfd5 100%)",
  },
  {
    id: "dark", label: "Dark",
    get url() { return `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${_mapKey}`; },
    preview: "linear-gradient(135deg, #1a1a22 0%, #2d2d3a 100%)",
  },
  {
    id: "terrain", label: "Terrain",
    get url() { return `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${_mapKey}`; },
    preview: "linear-gradient(135deg, #8a9d6b 0%, #c4b18a 50%, #b89870 100%)",
  },
];

function setMapKey(key) { _mapKey = key; }

window.MockData = {
  get PIPELINE_ROUTE() { return PIPELINE_ROUTE; },
  get ROUTE_CUMKM() { return ROUTE_CUMKM; },
  get TOTAL_KM() { return TOTAL_KM; },
  PIN_BASE_KM,
  MAP_STYLES,
  haversineKm,
  coordAtKm,
  snapToRoute,
  setupRoute,
  setMapKey,
};
