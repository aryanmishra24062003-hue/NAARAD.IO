#!/usr/bin/env node
// Converts all GPX files in /routes to a single gpx-tracks.json
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');

// Deduplicated route list — skip numbered duplicates
const ROUTE_META = [
  { file: 'adambakkam-velachcheri.gpx',          name: 'Adambakkam to Velachcheri',      color: '#16A34A', icon: '🚶', type: 'walk' },
  { file: 'chennai.gpx',                          name: 'Chennai City Walk',               color: '#1E3161', icon: '🌆', type: 'walk' },
  { file: 'iitm-ashtalashmi-temple-chennai.gpx', name: 'IITM to Ashtalakshmi Temple',    color: '#DC2626', icon: '🕌', type: 'heritage-walk' },
  { file: 'iitm-mercat-reparar-ordinador-aeroport.gpx', name: 'IITM Airport Route',      color: '#7C3AED', icon: '✈️', type: 'walk' },
  { file: 'velachcheri-mylapore.gpx',            name: 'Velachcheri to Mylapore',         color: '#EA580C', icon: '🏛️', type: 'heritage-walk' },
  { file: 'velachcheri.gpx',                     name: 'Velachcheri Trail',               color: '#0891B2', icon: '🌿', type: 'walk' },
  { file: 'voltes-pel-barri-taramani-chennai.gpx', name: 'Taramani Neighbourhood Walk', color: '#DB2777', icon: '🏘️', type: 'walk' },
  { file: 'voltes-per-chennai-iitm-lighthouse.gpx', name: 'IITM to Marina Lighthouse',  color: '#B45309', icon: '🔦', type: 'heritage-walk' },
];

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const tracks = [];

for (const meta of ROUTE_META) {
  const filePath = path.join(routesDir, meta.file);
  if (!fs.existsSync(filePath)) {
    console.warn('SKIP (not found):', meta.file);
    continue;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const coords = [];
  for (const m of text.matchAll(/trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g)) {
    coords.push([parseFloat(m[1]), parseFloat(m[2])]);
  }
  if (coords.length < 2) {
    console.warn('SKIP (no coords):', meta.file);
    continue;
  }

  let dist = 0;
  for (let i = 1; i < coords.length; i++) dist += haversineKm(coords[i - 1], coords[i]);

  // Centre-point for map pan
  const midIdx = Math.floor(coords.length / 2);
  const center = coords[midIdx];

  tracks.push({
    id: tracks.length + 1,
    file: meta.file,
    name: meta.name,
    color: meta.color,
    icon: meta.icon,
    type: meta.type,
    dist_km: +dist.toFixed(2),
    center,
    coords,
  });

  console.log(`  ✓ ${meta.name} — ${coords.length} pts, ${dist.toFixed(1)} km`);
}

const out = path.join(routesDir, 'gpx-tracks.json');
fs.writeFileSync(out, JSON.stringify({ tracks }, null, 0));
console.log(`\nWrote ${tracks.length} tracks → ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
