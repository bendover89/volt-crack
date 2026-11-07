# volt-crack

Static, version-agnostic patcher for **Volt** (a Tauri-based Roblox script
executor). It disables the client-side license/authentication system entirely
by patching the app's embedded frontend JavaScript — no runtime patching, no
local servers, no network trickery. The cracked build runs fully offline in
the app's built-in **NoAuth mode** with every feature unlocked.

```
node src/volt_universal_crack.js "C:\Path\To\tauri-app.exe"
# -> tauri-app CRACKED.exe
```

## How it works (TL;DR)

1. **Tauri apps embed their frontend** as brotli-compressed blobs, stored
   right after plaintext asset-path strings (`/assets/index-*.js`) inside the
   executable.
2. The patcher scans the binary for those paths, decompresses every JS blob,
   and finds the auth module by **content markers** (`authenticationEnabled`,
   `signed_out`, `claim_license`, …) — not by file name, so it survives
   version bumps and hash renames.
3. It flips the two auth gates:
   - `KR()` — returns `!authenticationEnabled`; forced to `return!0`, which
     puts the whole app into its built-in **NoAuth mode** (all features
     unlocked, no license checks).
   - `NWt(n)` — the sign-in state check (`n.status !== "signed_out"`);
     forced to `return!0`.
4. The patched JS is recompressed (brotli q11), **zero-padded back to the
   original blob size**, and re-embedded. Brotli decoders stop at the end of
   the stream, so the padding is invisible to the app. The binary's size,
   layout and PE structure never change.
5. The result is verified by decompressing the blob back out of the patched
   binary and checking the patch markers.

See [`docs/METHOD.md`](docs/METHOD.md) for the full write-up.

## Requirements

- [Node.js](https://nodejs.org/) (uses only built-in `fs` + `zlib`)
- A legally obtained copy of Volt (`tauri-app.exe`) — you must own a license

## Usage

```text
node src/volt_universal_crack.js <tauri-app.exe> [output.exe]
```

- `<tauri-app.exe>` — path to the Volt UI binary (usually
  `%LOCALAPPDATA%\Volt\tauri-app.exe`). If omitted, the script tries the
  default install location.
- `[output.exe]` — defaults to `<input> CRACKED.exe` next to the input.
- The script never modifies the original file.

On success you get a patch report per asset, then `verification: PASSED`.
Re-run it any time Volt updates: the cracker re-locates the auth module and
re-applies the patches to the new version. Re-running on an already-cracked
binary is a no-op (the patches are idempotent).

## Repository layout

```
src/volt_universal_crack.js   version-agnostic cracker (use this one)
src/volt_crack.js             minimal one-shot example (fixed asset name)
docs/METHOD.md                reverse-engineering write-up
```

## Legal

This project is published for **security research and education** — it
documents how desktop apps that keep secrets in client-side JavaScript are
trivially mutable. Do not use it to run software you have not licensed.
No proprietary binaries, assets, or vendor code are included in this
repository; the patcher operates on a binary you supply yourself.
