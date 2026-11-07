// =============================================================================
//  VOLT UNIVERSAL CRACK — works on any version
//  Usage: node volt_universal_crack.exe [path-to-tauri-app.exe]
//  Finds the auth-gating JS asset automatically, patches it, re-embeds.
// =============================================================================

const fs = require('fs');
const zlib = require('zlib');

const exePath = process.argv[2] || (() => {
  // auto-detect: check common Volt install locations
  const candidates = [
    process.env.LOCALAPPDATA + '\\Volt\\tauri-app.exe',
    process.env.LOCALAPPDATA + '\\volt\\tauri-app.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  console.log('ERROR: tauri-app.exe not found. Pass the path as an argument.');
  process.exit(1);
})();

console.log('target:', exePath);
const data = fs.readFileSync(exePath);
console.log('size:', data.length, 'bytes');

// ===== STEP 1: find ALL /assets/*.js paths =====
const pathStr = '/assets/';
let paths = [];
let pos = 0;
while (true) {
  const idx = data.indexOf(pathStr, pos, 'ascii');
  if (idx < 0) break;
  let e = idx;
  while (e < data.length && data[e] >= 0x20 && data[e] <= 0x7E) e++;
  let p = data.toString('ascii', idx, e);
  // trim to known extension
  const exts = ['.js', '.css', '.html', '.json', '.wasm', '.ttf'];
  let best = -1;
  for (const ext of exts) {
    const ei = p.indexOf(ext);
    if (ei >= 0 && (best < 0 || ei + ext.length > best)) best = ei + ext.length;
  }
  if (best > 0) p = p.substring(0, best);
  if (p.endsWith('.js') && p.length > 15 && p.length < 100) {
    paths.push({ path: p, dataOff: idx + p.length, pathOff: idx });
  }
  pos = idx + 1;
}
console.log('JS assets found:', paths.length);

// ===== STEP 2: decompress each and find the one with auth markers =====
const AUTH_MARKERS = ['authenticationEnabled', 'signed_out', 'claim_license', 'get_hwid'];
const PATCH_PATTERNS = [
  {
    // the auth master switch
    match: /return!gGe\(\)\.authenticationEnabled/,
    replace: 'return!0/*auth_disabled*/',
    description: 'KR() -> auth disabled (NoAuth mode)'
  },
  {
    // the sign-in check
    match: /return n\.status!=="signed_out"/,
    replace: 'return!0/*signed_in*/',
    description: 'NWt() -> always signed in'
  },
  // generic patterns that survive minification:
  {
    match: /authenticationEnabled/,
    replace: 'authenticationEnabled&&!1',
    description: 'authenticationEnabled -> false'
  },
  // ── real-build illusion: make the app believe it is a licensed build ──
  {
    // capabilities accessor -> report real-build capabilities
    // (robloxIntegration is the flag the UI checks before allowing attach/execute)
    match: /function \w+\(\)\{return \w+\(\)\.capabilities\}/,
    replace: 'function capsReal(){return{robloxIntegration:1,processManagement:1,processMetrics:1,secureSecretStorage:1,browserLogin:1}}/*realbuild*/',
    description: 'capabilities() -> real-build capabilities (robloxIntegration on)'
  },
  {
    // attach/execute gate: Wzi().robloxIntegration && !KR() && roblox installed &&
    // path && version && kind!=="unsupported"  ->  always allowed
    match: /function \w+\(n\)\{return!!\(\w+\(\)\.robloxIntegration&&!\w+\(\)&&n\?\.roblox\.installed&&n\.roblox\.path&&n\.roblox\.version&&n\.roblox\.kind!=="unsupported"\)\}/,
    replace: 'function attachAllowedReal(){return!0}/*realbuild*/',
    description: 'aKi() -> always true (real-build attach gate)'
  },
  // ── real-build profile: GOONERCELL, member since 7 years ──
  {
    // profile header: fake founder-tier user (header is null without auth user)
    match: /function Qzi\(\)\{const\{user:n\}=eJ\(\),\{settings:e\}=Jd\(\);if\(!n\)return null;/,
    replace: 'function Qzi(){const n={username:"GOONERCELL",email:"goonercell@vibecoded.volt",role:"owner",resellerTier:"founder",createdAt:"2019-11-07T00:00:00.000Z",id:"vc-1"},{settings:e}=Jd();/*realprofile*/',
    description: 'Qzi() -> profile header: GOONERCELL, member since 2019-11-07'
  },
  {
    // active subscription query -> fake active plan
    match: /async function Hzi\(\)\{return \w+\("get_active_subscription"\)\}/,
    replace: 'async function Hzi(){return{id:"vibecoded",planSlug:"GOONERCELL",hasActiveSubscription:!0}}/*realprofile*/',
    description: 'get_active_subscription -> fake GOONERCELL plan'
  },
  {
    // subscription license keys -> fake 7-year-old license row
    match: /function Vzi\(n\)\{return \w+\("get_subscription_keys",\{subscriptionId:n\}\)\}/,
    replace: 'function Vzi(n){return[{id:"vc-7y",key:"GOONERCELL",claimedAt:"2019-11-07T00:00:00.000Z",plan:{code:"GOONERCELL"}}]}/*realprofile*/',
    description: 'get_subscription_keys -> GOONERCELL license, claimed 7 years ago'
  },
  {
    // enable the subscription query (was disabled when KR() true)
    match: /queryKey:Ype\.activeSubscription,queryFn:Hzi,enabled:!e/,
    replace: 'queryKey:Ype.activeSubscription,queryFn:Hzi,enabled:!0',
    description: 'subscription query -> enabled'
  },
  {
    // enable the license-keys query
    match: /queryFn:\(\)=>Vzi\(d\.id\),enabled:!e&&!!d/,
    replace: 'queryFn:()=>Vzi(d.id),enabled:!0&&!!d',
    description: 'license-keys query -> enabled'
  },
];

let mainAsset = null;
for (const p of paths) {
  const slice = data.slice(p.dataOff, Math.min(p.dataOff + 5000000, data.length));
  try {
    const dec = zlib.brotliDecompressSync(slice);
    const str = dec.toString('utf8');
    const matches = AUTH_MARKERS.filter(m => str.includes(m));
    if (matches.length >= 2) {
      console.log('AUTH ASSET FOUND: ' + p.path + ' (' + dec.length + ' bytes, markers: ' + matches.join(', ') + ')');
      mainAsset = { ...p, js: dec, str: str };
      break;
    }
  } catch (e) { /* not this one */ }
}

if (!mainAsset) {
  console.log('ERROR: could not find the auth asset. The frontend structure may have changed.');
  process.exit(1);
}

// ===== STEP 3: apply patches (same-length where possible) =====
let jsStr = mainAsset.str;
let applied = 0;

for (const patch of PATCH_PATTERNS) {
  const matches = jsStr.match(patch.match);
  if (!matches) { console.log('  skip: ' + patch.description + ' (pattern not found)'); continue; }

  // for each occurrence
  let searchFrom = 0;
  let count = 0;
  while (true) {
    const m = jsStr.substring(searchFrom).match(patch.match);
    if (!m) break;
    const idx = searchFrom + m.index;
    const original = m[0];

    // build same-length replacement
    let replacement = patch.replace;
    if (replacement.length < original.length) {
      // pad with spaces inside the expression
      replacement = replacement.padEnd(original.length);
    } else if (replacement.length > original.length) {
      // try to shrink by using shorter forms
      replacement = replacement.substring(0, original.length);
    }

    jsStr = jsStr.substring(0, idx) + replacement + jsStr.substring(idx + original.length);
    applied++;
    count++;
    console.log('  patched: ' + patch.description + ' @ ' + idx + ' (' + original.length + ' -> ' + replacement.length + ' chars)');

    searchFrom = idx + replacement.length;
  }
}
console.log('total patches applied:', applied);

if (applied === 0) {
  console.log('WARNING: no patches applied! The auth system may have changed.');
  console.log('Attempting fallback: force authenticationEnabled to false...');
  // fallback: find any occurrence and replace
  const idx = jsStr.indexOf('authenticationEnabled');
  if (idx >= 0) {
    jsStr = jsStr.substring(0, idx) + 'authenticationDisabled' + jsStr.substring(idx + 21);
    applied++;
    console.log('fallback patch applied');
  }
}

// ===== STEP 4: recompress =====
const newJs = Buffer.from(jsStr, 'utf8');
console.log('patched JS size:', newJs.length);

// find original compressed size
let origSize = -1;
// assets are laid out as [path string][brotli blob] back to back:
// the end of this blob is the start of the NEXT asset's path string
let nextPathStart = -1;
for (const p of paths) {
  if (p.pathOff > mainAsset.dataOff) {
    nextPathStart = p.pathOff;
    break;
  }
}
if (nextPathStart > mainAsset.dataOff) {
  origSize = nextPathStart - mainAsset.dataOff;
}
if (origSize < 0) origSize = 2000000; // guess
console.log('original compressed region:', origSize, 'bytes');

let best = null;
for (const q of [11, 10, 9, 8, 7, 6, 5, 4]) {
  const c = zlib.brotliCompressSync(newJs, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: q } });
  if (!best || c.length < best.length) best = c;
  if (c.length <= origSize) { best = c; console.log('  q' + q + ': ' + c.length + ' (fits)'); break; }
  console.log('  q' + q + ': ' + c.length);
}
console.log('best compressed:', best.length, 'bytes');

// pad to original size
if (best.length < origSize) {
  const pad = Buffer.alloc(origSize - best.length);
  best = Buffer.concat([best, pad]);
}

// ===== STEP 5: re-embed =====
const patched = Buffer.from(data);
best.copy(patched, mainAsset.dataOff);

// write to a NEW file (don't overwrite the original)
const outPath = exePath.replace(/\.exe$/, ' CRACKED.exe');
fs.writeFileSync(outPath, patched);
console.log('written:', outPath);

// ===== STEP 6: verify =====
const vData = fs.readFileSync(outPath);
const vSlice = vData.slice(mainAsset.dataOff, Math.min(mainAsset.dataOff + 5000000, vData.length));
try {
  const vJs = zlib.brotliDecompressSync(vSlice);
  const vStr = vJs.toString('utf8');
  const vOk = vStr.includes('auth_disabled') || vStr.includes('authenticationDisabled') || vStr.includes('realbuild') || !vStr.includes('return!gGe()');
  console.log('verification:', vOk ? 'PASSED' : 'FAILED');
  console.log('cracked binary ready:', outPath);
} catch (e) {
  console.log('verify decompress failed:', e.message);
}
