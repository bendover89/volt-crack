# Volt Cracked

NoAuth build of the **Volt** executor (v1.0.23) — a Tauri-based Roblox script
executor with its client-side license/authentication system patched out. The
patched app runs fully offline: no login, no key, no subscription check.

> **Status:** published as-is for research and personal use. No warranty.
> See [LICENSE](LICENSE).

---

## Repository layout

This repo is **source-only**. Vendor binaries are intentionally *not* committed —
they are opaque compiled blobs with no source available, so they cannot be
reviewed here and would bloat the repository.

```
volt_universal_crack.js   version-agnostic patcher (this repo's actual tool)
src/volt_universal_crack.js   same patcher, canonical location (kept in sync)
src/volt_crack.js             minimal one-shot example (fixed asset name)
docs/METHOD.md                reverse-engineering write-up
setup.ps1                 quick setup for an existing Volt install
install.ps1               full installer for a fresh install
build.bat                 validates all scripts + packages a release zip
LICENSE                   MIT
```

Binaries referenced by the scripts (distributed separately, not via git):

| File | Role |
|---|---|
| `tauri-app.exe` | patched Volt UI (NoAuth) |
| `Executor.dll`  | executor module injected into Roblox |
| `Emulator.dll`  | emulator module |
| `volt.bin`      | Roblox client payload |
| `volt-installer.exe` | original NSIS installer (fresh installs) |

## Usage

```bat
:: validate everything and build a release zip
build.bat
```

```powershell
# existing Volt install
.\setup.ps1            # run as Administrator

# fresh install
.\volt-installer.exe   # then:
.\install.ps1          # run as Administrator
```

```bat
:: re-apply the patch yourself to any Volt version
node volt_universal_crack.js "C:\Path\To\tauri-app.exe"
```

## How the patch works

1. Tauri apps embed their frontend as brotli-compressed blobs, stored right
   after plaintext asset-path strings (`/assets/index-*.js`) in the executable.
2. The patcher scans for those paths, decompresses every JS blob, and locates
   the auth module by **content markers** (`authenticationEnabled`,
   `signed_out`, `claim_license`, ...) — not file names — so it survives
   version bumps and hash renames.
3. It flips the auth gates:
   - `KR()` → forced `return!0` → the app enters its built-in **NoAuth mode**
     (all features unlocked, no license checks).
   - `NWt(n)` (sign-in state check) → forced `return!0`.
4. The patched JS is recompressed (brotli q11), zero-padded back to the
   original blob size, and re-embedded. File size and PE layout never change.
5. Verification: the blob is decompressed back out of the patched binary and
   the patch markers are checked.

Re-running the patcher on a new Volt version re-locates the module and
re-applies. Running it on an already-patched binary is a no-op.

## Network behavior

The autoupdater is neutralized by hosts entries (`api.voltbz.net` → `127.0.0.1`)
so Volt can never download a new version to restore the license check.

## Static audit summary

Performed on the distributed binaries (2026-11-07). Full import tables and
string surfaces were reviewed; highlights:

| File | Result |
|---|---|
| `Executor.dll` | Imports: process memory R/W, thread enum, sockets, D3D — consistent with an executor. No persistence APIs (no service creation, no Run keys, no scheduled tasks). String surface: Roblox asset domains, libcurl, OpenSSL, protobuf. No C2/exfil markers (no webhooks, no telegram, no stealer paths like `Login Data`/`Local State`). Bare "IPs" found are X.509 OID arcs, not addresses. |
| `Emulator.dll` | No rat markers. Single embedded URL is `https://voltbz.net/terms` (the vendor's ToS page). |
| `tauri-app.exe` | Auth-module markers present as described. TLS via rustls 0.23.42. URLs extracted from compressed frontend blobs are decompression noise. |
| `volt-installer.exe` | Plain NSIS package, no markers. |
| `volt.bin` | **Not auditable** — 109.6 MB at ~8.000 bits/byte entropy (fully encrypted/compressed). Treated as opaque. |

Verify what you download:

```powershell
Get-FileHash .\Executor.dll -Algorithm SHA256
# de90e442bf381d0c3ad09c9b9480805591d8d7ecb036fca875e7a0bb72d357ed
```

## Legal

This project documents how desktop apps that keep secrets in client-side
JavaScript are trivially mutable. It is published for research and education.
Do not use it with software you have not licensed. No proprietary binaries,
assets, or vendor code are included in this repository.
