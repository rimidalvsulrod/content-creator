import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const sm = (e0, e1, x) => Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const bg = [10, 10, 13], red = [255, 59, 71], white = [255, 255, 255];
  const c = size / 2, aa = 1.2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      let px = bg;
      const ringO = size * 0.34, ringI = size * 0.29, dot = size * 0.23;
      px = mix(px, white, (1 - sm(ringO - aa, ringO + aa, d)) * sm(ringI - aa, ringI + aa, d));
      px = mix(px, red, 1 - sm(dot - aa, dot + aa, d));
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const s of [180, 192, 512]) writeFileSync(`public/icon-${s}.png`, png(s));
console.log('icons written');
