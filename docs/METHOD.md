# Method: statically patching Volt's embedded frontend

This document describes, end to end, how Volt's client-side authentication was
located and neutralized with a static patch — and why the technique generalizes
to essentially any Tauri (or similar webview-shell) application that ships its
UI inside the executable.

Everything below was done with nothing but a hex scan of the binary, Node's
built-in `zlib`, and re-decompression to verify. No debuggers, no disassembler,
no network interception.

---

## 1. Target architecture

Volt is a [Tauri v2](https://tauri.app/) application:

```
tauri-app.exe        <- Rust host + embedded webview frontend (the target)
Executor.dll         <- native executor module (separate concern, not patched)
Emulator.dll / ...   <- support modules
```

The Rust host serves the Svelte/JS frontend to the WebView2 control from
**assets embedded directly in the executable**. The key observation:

- Every asset is stored as a **plaintext path string** (`/assets/index-*.js`,
  `/assets/*.css`, …) immediately followed by the **brotli-compressed**
  asset body.
- Nothing is encrypted. Nothing is integrity-checked. The paths are readable
  with `strings`.

## 2. Locating and extracting the frontend

Scanning for `/assets/` byte-sequences and reading forward until a
non-printable byte yields the path strings. The compressed body starts at
`pathOffset + pathLength`.

`zlib.brotliDecompressSync()` on that slice recovers the original file. A
slice longer than the actual stream is fine — the brotli decoder stops at the
stream's final byte. That property is what makes re-embedding painless later.

## 3. Finding the auth logic

Rather than searching for a hardcoded bundle name (`index-CtzsKNRv.js` —
valid for exactly one build), the auth module is identified by **content
markers**. Grep the decompressed assets for strings like:

| marker                  | meaning                                    |
|-------------------------|--------------------------------------------|
| `authenticationEnabled` | the backend-driven auth master flag        |
| `signed_out`            | auth-state enum value                      |
| `claim_license`         | license activation RPC                     |
| `get_hwid`              | hardware-id RPC                            |

The bundle that matches several of these at once is the auth brain.

## 4. The auth design flaw

Volt's frontend contains two functions of interest (names from the minified
build):

```js
// KR(): "are we in NoAuth mode?"
function KR() { return !gGe().authenticationEnabled }

// NWt(n): "is this auth state signed in?"
function NWt(n) { return n.status !== "signed_out" }
```

`authenticationEnabled` is a property the app reads from its backend. The
interesting part: **the app ships a first-class NoAuth mode** — presumably for
self-hosted or development use. When `authenticationEnabled` is false, the UI
unlocks everything and simply skips licensing.

Because the gate lives in mutable client-side JavaScript, both functions can
be forced:

```js
function KR() { return !0 }   // NoAuth mode, always
function NWt(n) { return !0 } // always "signed in"
```

## 5. Same-length patching

The patch replaces bytes in place, padding with spaces to keep the length
identical:

```
return!gGe().authenticationEnabled  ->  return!0<spaces...>
return n.status!=="signed_out"      ->  return!0<spaces...>
```

Same-length edits mean the surrounding minified code is untouched and offsets
are stable. (The universal cracker also proves re-embedding tolerates
*different* lengths thanks to the padding trick below, so same-length is a
convenience, not a requirement.)

## 6. Recompression and re-embedding

1. Recompress the patched JS with brotli quality 11. Minified bundles
   typically recompress smaller than the original (the original was written
   by a bundler at some quality, and our edits barely change entropy).
2. **Zero-pad the compressed blob back to the original region size** and copy
   it over the original bytes at `dataOffset`.
3. The binary's total size, section layout and PE headers are unchanged —
   any signature/size sanity checks outside the blob still pass.

Why trailing zeros are safe: a brotli stream is self-terminating. The decoder
finishes at the end-of-stream marker and never reads the padding. This was
confirmed by decompressing the blob back out of the patched binary.

If a future build's patched JS ever recompressed *larger* than the original
region, the cracker walks quality 11 -> 4 until it fits (it hasn't needed to).

## 7. Verification

The cracker re-reads its own output, decompresses the blob from the patched
binary, and asserts the patch markers are present. Verification failure is a
hard error, not a warning.

## 8. Version resilience

The universal cracker (`src/volt_universal_crack.js`) makes no assumptions
about:

- **bundle names** — assets are discovered by scanning, matched by content
- **minified symbol names** (`gGe`, `n`, …) — patches anchor on structural
  strings (`authenticationEnabled`, `"signed_out"`)
- **region layout** — the end of a blob is derived from the next `/assets/`
  path occurrence, not from hardcoded offsets
- **re-runs** — patches are idempotent; cracking an already-cracked binary is
  a no-op

## 9. The general lesson

Any "licensing" system whose decision function executes inside a webview
belongs to the user of the machine, not to the vendor. If the unlock
condition is a boolean in shipped JavaScript, it is a UI preference, not a
security boundary. Vendors who need real protection need it server-side —
and even then, the client must ultimately trust *something* local to draw
the UI.

This repository keeps only the patcher and this write-up. The technique is
generic; the markers above are just this app's vocabulary.
