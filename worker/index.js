import { api } from '../server/handler.js';
import assets from './assets.generated.js';

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/api/')) return api(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método no permitido', { status: 405 });
    const asset = assets[pathname === '/' ? '/index.html' : pathname];
    if (!asset) return new Response('No encontrado', { status: 404 });
    const content = asset.binary ? Uint8Array.from(atob(asset.content), c => c.charCodeAt(0)) : asset.content;
    return new Response(request.method === 'HEAD' ? null : content, { headers: {
      'content-type': asset.type,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'cache-control': 'no-cache',
    } });
  },
};
