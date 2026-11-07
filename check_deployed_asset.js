// check_deployed_asset.js — extract the frontend from the deployed exe and
// verify it parses as an ES module (the real blank-UI test)
const fs = require('fs');
const zlib = require('zlib');
const { execSync } = require('child_process');

const exePath = process.argv[2];
const data = fs.readFileSync(exePath);
console.log('target:', exePath, data.length, 'bytes');

const marker = '/assets/index-CtzsKNRv.js';
const idx = data.indexOf(Buffer.from(marker, 'ascii'));
if (idx < 0) { console.log('auth asset path not found'); process.exit(1); }
const dataOff = idx + marker.length;
const js = zlib.brotliDecompressSync(data.slice(dataOff, dataOff + 5000000)).toString('utf8');
console.log('asset size:', js.length);

// patch-state check
for (const m of ['GOONERCELL', 'realprofile', 'VibeCoded Volt', 'capsReal(){return{robloxIntegration:1,processManagement:1,processMetrics:1,secureSecretStorage:1,browserLogin:1}}', 'attachAllowedReal', '/*rb*/']) {
  console.log((js.includes(m) ? 'FOUND  ' : 'absent ') + m);
}

// syntax check as ES module
const tmp = 'C:/Users/seilwareglazer/AppData/Local/Temp/opencode/asset_check.mjs';
fs.writeFileSync(tmp, js);
try {
  execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
  console.log('SYNTAX CHECK: PASSED (valid ES module)');
} catch (e) {
  const err = e.stderr ? e.stderr.toString() : e.message;
  console.log('SYNTAX CHECK: FAILED');
  console.log(err.slice(0, 800));
  // show the failing line
  const m = err.match(/(\d+):(\d+)/);
  if (m) {
    const line = parseInt(m[1]);
    const lines = js.split('\n');
    for (let i = Math.max(0, line - 3); i < Math.min(lines.length, line + 2); i++) {
      console.log(`${i + 1}: ${lines[i].slice(0, 200)}`);
    }
  }
  process.exit(1);
}
