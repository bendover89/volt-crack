// =============================================================================
//  VOLT ONE-SHOT CRACK (historical, v2.0.x-specific)
//  The original site-specific cracker: targets /assets/index-CtzsKNRv.js by
//  exact name. Superseded by volt_universal_crack.js which discovers the auth
//  asset by content markers instead. Kept as the minimal readable example of
//  the technique.
//
//  Usage: node volt_crack.js <tauri-app.exe> <output.exe>
// =============================================================================

const fs = require('fs');
const zlib = require('zlib');

const exePath = process.argv[2] || 'tauri-app.exe';
const outPath = process.argv[3] || exePath.replace(/\.exe$/i, ' CRACKED.exe');

const data = fs.readFileSync(exePath);
console.log('loaded:', data.length, 'bytes');

// ===== STEP 1: find the asset path for the main bundle =====
const pathStr = '/assets/index-CtzsKNRv.js';
const pathIdx = data.indexOf(pathStr, 0, 'ascii');
if (pathIdx < 0) { console.log('ERROR: path not found'); process.exit(1); }
const dataOff = pathIdx + pathStr.length;
console.log('asset path @ 0x' + pathIdx.toString(16) + ', data @ 0x' + dataOff.toString(16));

// ===== STEP 2: decompress the current JS =====
const slice = data.slice(dataOff, Math.min(dataOff + 5000000, data.length));
let js;
try {
  js = zlib.brotliDecompressSync(slice);
} catch (e) { console.log('decompress failed:', e.message); process.exit(1); }
console.log('decompressed:', js.length, 'bytes');

let jsStr = js.toString('utf8');

// ===== STEP 3: apply the patches =====
// 1. KR() - the auth master switch. Returns !authenticationEnabled, i.e. the
//    whole app runs in built-in NoAuth mode when the backend says auth is off.
//    Forcing it to return true = NoAuth mode regardless of backend.
// 2. NWt(n) - the sign-in state check: n.status !== "signed_out".
//    Forcing true = every auth-state read behaves as "signed in".
const patches = [
  { from: 'return!gGe().authenticationEnabled', to: 'return!0' },
  { from: 'return n.status!=="signed_out"',     to: 'return!0' },
];

let applied = 0;
for (const p of patches) {
  const idx = jsStr.indexOf(p.from);
  if (idx < 0) { console.log('  skip (not found):', p.from); continue; }
  // same-length replace: pad the tail with spaces so offsets stay stable
  let rep = p.to;
  while (rep.length < p.from.length) rep += ' ';
  jsStr = jsStr.substring(0, idx) + rep + jsStr.substring(idx + p.from.length);
  applied++;
  console.log('  patched @', idx, ':', p.from, '->', p.to);
}
console.log('patches applied:', applied);
if (applied === 0) process.exit(1);

// ===== STEP 4: recompress + pad + re-embed =====
const newJs = Buffer.from(jsStr, 'utf8');
const recompressed = zlib.brotliCompressSync(newJs, {
  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 }
});
console.log('recompressed:', recompressed.length, 'bytes (region:', slice.length, ')');

let finalData = recompressed;
if (recompressed.length < slice.length) {
  finalData = Buffer.concat([recompressed, Buffer.alloc(slice.length - recompressed.length)]);
}
if (recompressed.length > slice.length) {
  console.log('ERROR: recompressed data larger than original region');
  process.exit(1);
}

const patched = Buffer.from(data);
finalData.copy(patched, dataOff);
fs.writeFileSync(outPath, patched);
console.log('written:', outPath);

// ===== STEP 5: verify by re-decompression =====
const v = fs.readFileSync(outPath);
const vJs = zlib.brotliDecompressSync(v.slice(dataOff, dataOff + finalData.length));
const vStr = vJs.toString('utf8');
console.log('verify: NoAuth =', vStr.includes('return!0') && !vStr.includes('return!gGe()'));
