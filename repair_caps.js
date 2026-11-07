// repair_caps.js — fix the truncated capabilities patch in an already-cracked exe
// the broken fragment is exactly: function capsReal(){return{robloxIntegratio  (41 chars)
// valid 41-char replacement:     function capsReal(){return!0}/*rb*/ + 6 spaces
const fs = require('fs');
const zlib = require('zlib');

const exePath = process.argv[2];
const data = fs.readFileSync(exePath);
console.log('target:', exePath, data.length, 'bytes');

// locate the auth asset
const marker = '/assets/index-CtzsKNRv.js';
const idx = data.indexOf(Buffer.from(marker, 'ascii'));
if (idx < 0) { console.log('asset path not found'); process.exit(1); }
const dataOff = idx + marker.length;
console.log('asset blob @', dataOff);

// decompress
const slice = data.slice(dataOff, Math.min(dataOff + 5000000, data.length));
const js = zlib.brotliDecompressSync(slice).toString('utf8');
console.log('asset size:', js.length);

// the broken fragment (exactly what the truncation left behind)
const broken = 'function capsReal(){return{robloxIntegratio';
const fixed = 'function capsReal(){return!0}/*rb*/      '; // 35 + 6 spaces = 41
if (!js.includes(broken)) {
  console.log('broken fragment not found - asset may already be healthy');
  process.exit(0);
}
const fixedJs = js.replace(broken, fixed);
console.log('repaired: %d chars -> %d chars', broken.length, fixed.length);

// sanity: the bundle is an ES module with top-level await, so vm.Script would
// reject it legitimately. Skip strict parsing; the decompress-verify at the
// end is the real check.

// recompress + re-embed
const newBuf = Buffer.from(fixedJs, 'utf8');
// original compressed region = next path string start - dataOff
const pathStr = '/assets/';
let nextPathStart = -1;
let pos = dataOff;
while (true) {
  const i = data.indexOf(Buffer.from(pathStr, 'ascii'), pos);
  if (i < 0) break;
  if (i > dataOff) { nextPathStart = i; break; }
  pos = i + 1;
}
let origSize = 2000000;
if (nextPathStart > dataOff) origSize = nextPathStart - dataOff;
console.log('original compressed region:', origSize);

let best = null;
for (const q of [11, 10, 9, 8, 7, 6, 5, 4]) {
  const c = zlib.brotliCompressSync(newBuf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: q } });
  if (!best || c.length < best.length) best = c;
  if (c.length <= origSize) { best = c; console.log('  q' + q + ': ' + c.length + ' (fits)'); break; }
  console.log('  q' + q + ': ' + c.length);
}
if (best.length < origSize) {
  best = Buffer.concat([best, Buffer.alloc(origSize - best.length)]);
}
const patched = Buffer.from(data);
best.copy(patched, dataOff);

fs.writeFileSync(exePath, patched);
console.log('written:', exePath);

// verify
const v = fs.readFileSync(exePath);
const vJs = zlib.brotliDecompressSync(v.slice(dataOff, dataOff + 5000000)).toString('utf8');
console.log('verify:', vJs.includes('capsReal(){return!0}') ? 'PASSED (valid caps fn present)' : 'FAILED');
