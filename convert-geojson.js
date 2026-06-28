#!/usr/bin/env node
// Converts GeoJSON route files in /routes to a single geo-tracks.json
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');

// Named routes — skip known duplicates (converted 3 = Beach ROute-3, converted 5 = Thiruvanmayur)
const ROUTE_META = [
  { file: 'Airport hiddenlake.geojson',   name: 'Airport Hidden Lake Trail',  color: '#7C3AED', icon: '✈️',  type: 'nature-hike' },
  { file: 'Beach ROute-3.geojson',         name: 'East Coast Beach Route',     color: '#0891B2', icon: '🌊',  type: 'coastal-walk' },
  { file: 'Beach trail.geojson',           name: 'Marina Beach Trail',         color: '#EA580C', icon: '🏖️',  type: 'coastal-walk' },
  { file: 'IIT Madras Wildlife.geojson',  name: 'IIT Madras Wildlife Walk',   color: '#16A34A', icon: '🦌',  type: 'nature-hike' },
  { file: 'Thiruvanmayur trail.geojson',  name: 'Thiruvanmayur Heritage Trail',color: '#DC2626', icon: '🕌',  type: 'heritage-walk' },
  { file: 'Velacherry track.geojson',     name: 'Velacherry Neighbourhood',   color: '#DB2777', icon: '🏘️',  type: 'walk' },
  { file: 'converted (4).geojson',         name: 'Velachcheri to Mylapore',    color: '#B45309', icon: '🏛️',  type: 'heritage-walk' },
  { file: 'lightouse-trail.geojson',      name: 'Marina Lighthouse Trail',    color: '#1E3161', icon: '🔦',  type: 'heritage-walk' },
];

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function extractCoords(geojson) {
  const coords = [];
  const feats = geojson.features || [geojson];
  for (const feat of feats) {
    const g = feat.geometry || feat;
    if (!g) continue;
    if (g.type === 'LineString') coords.push(...g.coordinates);
    else if (g.type === 'MultiLineString') g.coordinates.forEach(l => coords.push(...l));
    else if (g.type === 'GeometryCollection') {
      for (const sub of (g.geometries || [])) {
        if (sub.type === 'LineString') coords.push(...sub.coordinates);
        else if (sub.type === 'MultiLineString') sub.coordinates.forEach(l => coords.push(...l));
      }
    }
  }
  return coords; // [lon, lat] pairs (GeoJSON standard)
}

const tracks = [];

for (const meta of ROUTE_META) {
  const filePath = path.join(routesDir, meta.file);
  if (!fs.existsSync(filePath)) { console.warn('SKIP (not found):', meta.file); continue; }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const lonLatCoords = extractCoords(data);
  if (lonLatCoords.length < 2) { console.warn('SKIP (no coords):', meta.file); continue; }

  // Convert to [lat, lon] for Leaflet
  const coords = lonLatCoords.map(c => [c[1], c[0]]);

  let dist = 0;
  for (let i = 1; i < lonLatCoords.length; i++) dist += haversineKm(lonLatCoords[i - 1], lonLatCoords[i]);

  const midIdx = Math.floor(coords.length / 2);

  tracks.push({
    id: tracks.length + 1,
    file: meta.file,
    name: meta.name,
    color: meta.color,
    icon: meta.icon,
    type: meta.type,
    dist_km: +dist.toFixed(2),
    center: coords[midIdx],
    coords,
  });

  console.log(`  ✓ ${meta.name} — ${coords.length} pts, ${dist.toFixed(1)} km`);
}

const out = path.join(routesDir, 'geo-tracks.json');
fs.writeFileSync(out, JSON.stringify({ tracks }, null, 0));
console.log(`\nWrote ${tracks.length} tracks → ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
