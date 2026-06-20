// Fetches building + road geometry from the OpenStreetMap Overpass API.
//
// `out geom;` returns each way with an inline `geometry` array of {lat, lon},
// so we don't need a second pass to resolve node ids. We cache the raw response
// in localStorage keyed by bbox so iterating on the renderer doesn't hammer the
// public Overpass mirrors (be a good citizen — they're free and shared).

import { OVERPASS } from '../config.js';

const CACHE_PREFIX = 'bq-osm:';

function buildQuery([s, w, n, e]) {
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:${OVERPASS.timeoutSec}];
(
  way["building"](${bbox});
  way["highway"](${bbox});
);
out geom;`;
}

export async function fetchOSM(bbox, { onStatus, fresh = false } = {}) {
  const cacheKey = CACHE_PREFIX + bbox.join(',');

  if (!fresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      onStatus?.('Loaded OSM from local cache.');
      return JSON.parse(cached);
    }
  }

  const body = 'data=' + encodeURIComponent(buildQuery(bbox));
  let lastErr;

  for (const endpoint of OVERPASS.endpoints) {
    try {
      onStatus?.(`Fetching ${bbox.join(', ')} from OpenStreetMap…`);
      const res = await fetch(endpoint, { method: 'POST', body });
      if (!res.ok) throw new Error(`${endpoint} -> HTTP ${res.status}`);
      const json = await res.json();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(json));
      } catch {
        /* quota — fine, we just won't cache */
      }
      onStatus?.(`OSM loaded: ${json.elements?.length ?? 0} elements.`);
      return json;
    } catch (err) {
      lastErr = err;
      onStatus?.(`Overpass mirror failed (${err.message}); trying next…`);
    }
  }

  throw new Error(`All Overpass mirrors failed: ${lastErr?.message}`);
}

// Split the raw element list into the two things the world builder cares about.
export function partition(osm) {
  const buildings = [];
  const roads = [];
  for (const el of osm.elements ?? []) {
    if (el.type !== 'way' || !el.geometry) continue;
    if (el.tags?.building) buildings.push(el);
    else if (el.tags?.highway) roads.push(el);
  }
  return { buildings, roads };
}
