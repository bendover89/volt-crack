// repair_caps2.js — replace the entire mangled caps region with the intended
// full function. search = mangled (repair1 splice + orphaned tail)
const fs = require('fs');
const zlib = require('zlib');

const exePath = process.argv[2];
const data = fs.readFileSync(exePath);
console.log('target:', exePath, data.length, 'bytes');

const marker = '/assets/index-CtzsKNRv.js';
const idx = data.indexOf(Buffer.from(marker, 'ascii'));
const dataOff = idx + marker.length;
const slice = data.slice(dataOff, Math.min(dataOff + 5000000, data.length));
const js = zlib.brotliDecompressSync(slice).toString('utf8');
console.log('asset size:', js.length);

const mangled =
  'function capsReal(){return!0}/*rb*/      n:1,processManagement:1,processMetrics:1,secureSecretStorage:1,browserLogin:1}}/*realbuild*/';
const intended =
  'function capsReal(){return{robloxIntegration:1,processManagement:1,processMetrics:1,secureSecretStorage:1,browserLogin:1}}/*realbuild*/';

if (!js.includes(mangled)) {
  console.log('mangled region not found');
  // show what capsReal looks like for debugging
  const i = js.indexOf('capsReal');
  console.log('capsReal context:', JSON.stringify(js.slice(i - 20, i + 200)));
  process.exit(1);
}
const fixedJs = js.replace(mangled, intended);
console.log('mangled %d chars -> intended %d chars', mangled.length, intended.length);

const newBuf = Buffer.from(fixedJs, 'utf8');
let nextPathStart = -1;
let pos = dataOff;
while (true) {
  const i = data.indexOf(Buffer.from('/assets/', 'ascii'), pos);
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

const v = fs.readFileSync(exePath);
const vJs = zlib.brotliDecompressSync(v.slice(dataOff, dataOff + 5000000)).toString('utf8');
const ok = vJs.includes(intended) && !vJs.includes('/*rb*/');
console.log('verify:', ok ? 'PASSED (clean caps fn, no splice residue)' : 'FAILED');
if (!ok) {
  const i = vJs.indexOf('capsReal');
  console.log('capsReal context:', JSON.stringify(vJs.slice(i - 10, i + 220)));
}
