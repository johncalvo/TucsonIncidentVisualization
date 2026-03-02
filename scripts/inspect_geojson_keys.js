#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../public/data');
const candidates = [
  'Tucson_Police_Incidents_-_2025_-_chunk_00.geojson',
  'Tucson_Police_Incidents_-_2024_-_chunk_00.geojson',
  'Tucson_Police_Incidents_-_2023_-_chunk_00.geojson',
  'Tucson_Police_Incidents_-_2022_-_chunk_00.geojson',
  'Tucson_Police_Incidents_-_2021_-_chunk_00.geojson'
];

function findFirstExistingFile() {
  for (const name of candidates) {
    const p = path.join(dataDir, name);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

const filePath = findFirstExistingFile();
if (!filePath) {
  console.error('No chunk file found in public/data.');
  process.exit(1);
}

console.log('Inspecting file:', path.basename(filePath));

const raw = fs.readFileSync(filePath, 'utf8');
const json = JSON.parse(raw);
const features = Array.isArray(json.features) ? json.features : [];

if (features.length === 0) {
  console.error('No features found in file.');
  process.exit(1);
}

const sampleSize = Math.min(200, features.length);
const keys = new Set();

for (let i = 0; i < sampleSize; i++) {
  const f = features[i];
  if (f && f.properties && typeof f.properties === 'object') {
    Object.keys(f.properties).forEach(k => keys.add(k));
  }
}

const sortedKeys = Array.from(keys).sort();
console.log('Property keys found (' + sortedKeys.length + '):');
for (const k of sortedKeys) {
  console.log(' -', k);
}
