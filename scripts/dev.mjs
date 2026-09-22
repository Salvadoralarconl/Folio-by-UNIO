import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const children = [];

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  children.push(child);
  return child;
}

const api = start(process.execPath, ['server/server.mjs'], {
  PORT: '1423',
  FOLIO_DATA: process.env.FOLIO_DATA || path.join(root, '.folio-data'),
});

const vite = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1']);

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 100).unref();
}

api.on('exit', code => {
  if (!stopping) {
    console.error(`Folio API stopped unexpectedly (${code ?? 'unknown'}).`);
    stop(code || 1);
  }
});

vite.on('exit', code => stop(code || 0));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
