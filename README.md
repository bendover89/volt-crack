# VibeCoded Volt

NoAuth build of the **Volt** executor (v1.0.23) with a full **real-build
illusion** layer: the patched app believes it is a licensed build, and the
profile says so. A community auto-updater keeps it current from this repo's
GitHub Releases — no vendor services involved, ever.

> **Status:** published as-is for research and personal use. No warranty.
> See [LICENSE](LICENSE).

---

## Repository layout

This repo ships the **full working package**: the patched host, the engine
modules, install scripts, the patcher, and our own auto-updater. The three PE
files ride in plain git; `volt.bin` is stored via Git LFS.

```
tauri-app.exe            patched Volt UI (NoAuth + real-build + GOONERCELL profile)
volt_universal_crack.js  version-agnostic patcher — 9 patches (this repo's actual tool)
setup.ps1                quick setup for an existing Volt install
install.ps1              full installer for a fresh install
update.ps1               community auto-updater (pulls from GitHub Releases)
build.bat                validates all scripts + packages a release zip
docs/METHOD.md           reverse-engineering write-up
src/                     additional patcher variants
LICENSE                  MIT
```

Engine modules (also attached to every GitHub Release):

| File | Size | Role |
|---|---|---|
| `tauri-app.exe` | 14.5 MB | patched Volt UI |
| `Executor.dll` | 30.2 MB | executor module injected into Roblox |
| `Emulator.dll` | 16.9 MB | emulator module |
| `volt.bin` | 104.5 MB | Roblox client payload (Git LFS) |

## The 9 patches

Applied by `volt_universal_crack.js` to the embedded frontend (brotli assets,
re-embedded zero-padded to the original blob size):

| # | Gate | Result |
|---|---|---|
| 1 | `KR()` auth master switch | NoAuth mode |
| 2 | `NWt()` sign-in check | always signed in |
| 3 | `Wzi()` capabilities | `robloxIntegration: on` (real-build caps) |
| 4 | `aKi()` attach/execute gate | always allowed |
| 5 | profile header | **GOONERCELL** • owner • founder • member since Nov 7, 2019 |
| 6 | `get_active_subscription` | active GOONERCELL plan |
| 7 | `get_subscription_keys` | GOONERCELL license, claimed 7 years ago |
| 8 | subscription query | enabled |
| 9 | license-keys query | enabled |

Patches 3-9 are the **real-build illusion**: the app behaves as if it were a
licensed veteran install. Patch 1-2 are the classic NoAuth gates. All patches
match structurally where possible so they survive minifier renames.

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

```powershell
# update to the latest community build
.\update.ps1           # pulls from GitHub Releases
.\update.ps1 -Check    # just check what changed
```

## How the patch works

1. Tauri apps embed their frontend as brotli-compressed blobs, stored right
   after plaintext asset-path strings (`/assets/index-*.js`) in the executable.
2. The patcher scans for those paths, decompresses every JS blob, and locates
   the auth module by **content markers** (`authenticationEnabled`,
   `signed_out`, `claim_license`, ...) — not file names — so it survives
   version bumps and hash renames.
3. It applies the 9 patches (same-length replacements where possible).
4. The patched JS is recompressed (brotli q11), zero-padded back to the
   original blob size, and re-embedded. File size and PE layout never change.
5. Verification: the blob is decompressed back out of the patched binary and
   the patch markers are checked.

## Auto-updater

The vendor's autoupdater is neutralized by hosts entries
(`api.voltbz.net` → `127.0.0.1`) so the stock app can never download a new
version to restore its license check. In its place, `update.ps1` pulls the
latest **community** build from this repo's Releases and installs it into
`%LOCALAPPDATA%\Volt` — host and engine modules stay in sync, verified by
SHA256, and the vendor is never contacted.

## Static audit summary

Performed on the distributed binaries (2026-11-07). Full import tables and
string surfaces were reviewed; highlights:

| File | Result |
|---|---|
| `Executor.dll` | Imports: process memory R/W, thread enum, sockets, D3D — consistent with an executor. No persistence APIs. String surface: Roblox asset domains, libcurl, OpenSSL, protobuf, a full Luau compiler pipeline. No C2/exfil markers. Bare "IPs" found are X.509 OID arcs. |
| `Emulator.dll` | No rat markers. Single embedded URL is `https://voltbz.net/terms` (the vendor's ToS page). |
| `tauri-app.exe` | Auth-module markers present as described. TLS via rustls. Host↔engine channel: loopback TCP `127.0.0.1:34254` (backend is the client; the engine serves). |
| `volt-installer.exe` | Plain NSIS package, no markers. |
| `volt.bin` | **Not auditable** — 109.6 MB at ~8.000 bits/byte entropy (fully encrypted/compressed). Treated as opaque. |

## Legal

This project documents how desktop apps that keep secrets in client-side
JavaScript are trivially mutable. It is published for research and education.
Do not use it with software you have not licensed. No proprietary *source
code* is included — only compiled artifacts and scripts, published as-is.
