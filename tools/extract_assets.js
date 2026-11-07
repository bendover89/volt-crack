// extract_assets.js — dump every brotli-embedded frontend asset from a Tauri exe
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const exePath = process.argv[2];
const outDir = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });

const data = fs.readFileSync(exePath);
console.log('target:', exePath, '(' + data.length + ' bytes)');

// find all /assets/* paths (js, css, html, json)
const pathStr = '/assets/';
let found = [];
let pos = 0;
while (true) {
  const idx = data.indexOf(pathStr, pos, 'ascii');
  if (idx < 0) break;
  let e = idx;
  while (e < data.length && data[e] >= 0x20 && data[e] <= 0x7E) e++;
  let p = data.toString('ascii', idx, e);
  const exts = ['.js', '.css', '.html', '.json', '.wasm', '.ttf'];
  let best = -1;
  for (const ext of exts) {
    const ei = p.indexOf(ext);
    if (ei >= 0 && (best < 0 || ei + ext.length > best)) best = ei + ext.length;
  }
  if (best > 0) {
    const clean = p.substring(0, best);
    if (clean.length > 10 && clean.length < 120) found.push({ path: clean, dataOff: idx + clean.length });
  }
  pos = idx + 1;
}
// dedupe, sort by offset, compute region ends
found = found.filter((v, i, a) => a.findIndex(x => x.path === v.path && x.dataOff === v.dataOff) === i);
found.sort((a, b) => a.dataOff - b.dataOff);
console.log('asset paths found:', found.length);

for (let i = 0; i < found.length; i++) {
  const f = found[i];
  const nextOff = (i + 1 < found.length) ? found[i + 1].dataOff - found[i + 1].path.length : Math.min(f.dataOff + 8000000, data.length);
  const region = data.slice(f.dataOff, Math.max(f.dataOff + 1, nextOff));
  const name = path.basename(f.path).replace(/[^a-zA-Z0-9._-]/g, '_');
  const outFile = path.join(outDir, i + '_' + name);
  // try brotli first
  let ok = false;
  try {
    const dec = zlib.brotliDecompressSync(region);
    fs.writeFileSync(outFile, dec);
    console.log('  [brotli] ' + f.path + ' -> ' + path.basename(outFile) + ' (' + dec.length + ' bytes)');
    ok = true;
  } catch (e) {
    // try gzip
    try {
      const dec = zlib.gunzipSync(region);
      fs.writeFileSync(outFile, dec);
      console.log('  [gzip]   ' + f.path + ' -> ' + path.basename(outFile) + ' (' + dec.length + ' bytes)');
      ok = true;
    } catch (e2) { /* not compressed */ }
  }
  if (!ok) {
    // dump raw (may be uncompressed asset or binary tail)
    if (region.length > 64 && region.length < 20000000) {
      fs.writeFileSync(outFile + '.raw', region);
      console.log('  [raw]    ' + f.path + ' (' + region.length + ' bytes, not compressed)');
    }
  }
}
console.log('done -> ' + outDir);
