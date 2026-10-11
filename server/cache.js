// Small byte cache. Uses the Workers Cache API when the host provides it and an
// in-memory map otherwise (local Node, or hosts where the Cache API is a no-op).
const memory = new Map();
const MAX_ENTRIES = 200;
const keyRequest = key => new Request('https://cache.brujula.invalid/' + key);

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} key @returns {Promise<ArrayBuffer | null>} */
export async function cacheGet(key) {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.body;
  memory.delete(key);
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const response = await caches.default.match(keyRequest(key));
      if (response) return await response.arrayBuffer();
    }
  } catch {}
  return null;
}

/** @param {string} key @param {ArrayBuffer} body @param {number} ttlSeconds */
export async function cachePut(key, body, ttlSeconds) {
  if (memory.size >= MAX_ENTRIES) memory.delete(memory.keys().next().value);
  memory.set(key, { body, expires: Date.now() + ttlSeconds * 1000 });
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      await caches.default.put(keyRequest(key), new Response(body, { headers: { 'cache-control': 'public, max-age=' + ttlSeconds, 'content-type': 'application/octet-stream' } }));
    }
  } catch {}
}

export async function cacheGetJSON(key) {
  const body = await cacheGet(key);
  if (!body) return null;
  try { return JSON.parse(new TextDecoder().decode(body)); } catch { return null; }
}
export const cachePutJSON = (key, value, ttlSeconds) => cachePut(key, new TextEncoder().encode(JSON.stringify(value)).buffer, ttlSeconds);
