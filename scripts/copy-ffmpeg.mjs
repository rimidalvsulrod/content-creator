import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const dst = path.join(root, 'public', 'ffmpeg');
mkdirSync(dst, { recursive: true });
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  if (!existsSync(path.join(src, f))) throw new Error(`missing ${f} - run npm install`);
  copyFileSync(path.join(src, f), path.join(dst, f));
}
console.log('ffmpeg core copied to public/ffmpeg');
