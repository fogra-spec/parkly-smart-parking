import {fileURLToPath} from 'node:url';
import {localPushKeys as pushKeys} from './local-push-keys.ts';
process.umask(0o077);
await pushKeys(fileURLToPath(new URL('../.local/',import.meta.url)));
console.log('Push keys ready in ignored backend/.local/.env (0600). Private keys were not printed.');
