import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './handler.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + req.headers.host);
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 8192) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
      const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) });
      const response = await api(request, process.env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, name);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404); res.end('No encontrado'); }
}).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Brújula: http://localhost:' + (process.env.PORT || 3000)));
