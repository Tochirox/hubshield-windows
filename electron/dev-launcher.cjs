const { spawn } = require('node:child_process');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const node = process.execPath;
const url = 'http://127.0.0.1:5173';
let vite;
let electron;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  vite?.kill();
  electron?.kill();
  process.exitCode = code;
}
function waitForVite(attempt = 0) {
  if (attempt > 120) { console.error('Vite n’a pas démarré sur le port 5173.'); stop(1); return; }
  const request = http.get(url, response => { response.resume(); if (response.statusCode && response.statusCode < 500) launchElectron(); else setTimeout(() => waitForVite(attempt + 1), 250); });
  request.on('error', () => setTimeout(() => waitForVite(attempt + 1), 250));
}
function launchElectron() {
  electron = spawn(node, [path.join(root, 'node_modules/electron/cli.js'), '.'], { cwd: root, env: { ...process.env, VITE_DEV_SERVER_URL: url }, stdio: 'inherit' });
  electron.once('error', error => { console.error(error); stop(1); });
  electron.once('exit', code => stop(code ?? 0));
}
try {
  execFileSync(node, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'electron/tsconfig.json')], { cwd: root, stdio: 'inherit' });
} catch { process.exit(1); }
vite = spawn(node, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: root, stdio: 'inherit' });
vite.once('error', error => { console.error(error); stop(1); });
vite.once('exit', code => { if (!stopping && electron) stop(code ?? 1); });
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
waitForVite();
