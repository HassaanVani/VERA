import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mode = process.argv[2] === 'start' ? 'start' : 'dev';
try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const common = ['--experimental-sqlite'];
const children = [
  spawn(process.execPath, [...common, '--import', 'tsx', 'scripts/worker.ts'], { stdio: 'inherit' }),
  spawn(process.execPath, [...common, require.resolve('next/dist/bin/next'), mode, '-H', '127.0.0.1', '-p', process.env.VERA_PORT || '3000'], { stdio: 'inherit' }),
];
let closing = false;
function stop(code = 0) { if (closing) return; closing = true; for (const c of children) c.kill(); setTimeout(() => process.exit(code), 1000).unref(); }
for (const c of children) c.on('exit', code => stop(code ?? 1));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
