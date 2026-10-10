// Credential values stay in process memory. Stdin is never echoed.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

console.log('Ready for Site credential JSON on stdin (input is hidden).');
if (process.stdin.isTTY) process.stdin.setRawMode(true);
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async chunk => {
  input += chunk;
  if (!input.includes('\n')) return;
  process.stdin.pause();
  let dir;
  try {
    const credential = JSON.parse(input.trim());
    input = '';
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'brujula-git-'));
    const askpass = path.join(dir, 'askpass.cjs');
    await fs.writeFile(askpass, '#!/usr/bin/env node\nprocess.stdout.write((process.argv[2] || "").toLowerCase().includes("username") ? "x-access-token" : process.env.BRUJULA_SITE_TOKEN);\n', { mode: 0o700 });
    const env = { ...process.env, GIT_ASKPASS: askpass, GIT_TERMINAL_PROMPT: '0', BRUJULA_SITE_TOKEN: credential.token };
    execFileSync('git', ['push', credential.remote_url, 'HEAD:' + credential.branch], { env, stdio: ['ignore', 'ignore', 'ignore'] });
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    console.log(JSON.stringify({ commit_sha: sha }));
    await fs.rm(dir, { recursive: true, force: true });
    process.exit(0);
  } catch {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
    console.error('La sincronización de la fuente de Sites ha fallado.');
    process.exit(1);
  }
});
