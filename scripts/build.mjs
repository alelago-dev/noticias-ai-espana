import fs from 'node:fs/promises';
import { build } from 'esbuild';

const mime = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', webmanifest: 'application/manifest+json', svg: 'image/svg+xml', png: 'image/png' };
const assets = {};
for (const name of await fs.readdir('public')) {
  const buffer = await fs.readFile('public/' + name);
  assets['/' + name] = { content: buffer.toString(name.endsWith('.png') ? 'base64' : 'utf8'), binary: name.endsWith('.png'), type: mime[name.split('.').pop()] || 'application/octet-stream' };
}
await fs.writeFile('worker/assets.generated.js', 'export default ' + JSON.stringify(assets) + ';\n');
await fs.rm('dist', { recursive: true, force: true });
await fs.mkdir('dist/server', { recursive: true });
await fs.mkdir('dist/.openai', { recursive: true });
await build({ entryPoints: ['worker/index.js'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: 'dist/server/index.js', minify: true, define: { 'process.env.NODE_ENV': '"production"' } });
await fs.copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
const worker = await import('../dist/server/index.js');
const r = await worker.default.fetch(new Request('https://brujula.test/'), {});
if (r.status !== 200 || !(await r.text()).includes('Brújula')) throw new Error('Worker artifact invalid');
console.log('Worker ESM preparado y verificado.');
