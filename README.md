# Bluesky Custom Media Feed

A personalized Bluesky media browser — images and videos only, from accounts you follow, packaged as a self-contained Linux desktop AppImage.

---

## Features

- **Media-only feed** — filters your timeline to posts with images, videos, or external media thumbnails; no text-only posts
- **Follows-aware** — shows content only from accounts you follow, including their reposts of media from other accounts
- **Infinite scroll** — automatically loads more posts as you scroll; a Load More button is also available
- **Lightbox / PostModal** — click any post to open a full-viewport lightbox with:
  - Full-resolution images with ‹ › carousel for multi-image posts
  - HLS video playback via hls.js (Bluesky stores videos as `.m3u8` playlists)
  - Like, repost, and reply without leaving the app
  - Live stat counts (updates after interactions)
- **External links in system browser** — "View on Bluesky" and all other external links open in your default browser, not inside the app window
- **Auto-login** — optionally save credentials (AES-256-GCM encrypted, machine-scoped) so the app logs in automatically on next launch
- **Auto-update** — built-in updater checks GitHub Releases on launch and prompts to install new versions; also supports GearLever / AppImageUpdate via embedded `.upd_info`

---

## System Requirements (AppImage)

| Requirement | Details |
|---|---|
| OS | Any Linux x86_64 distro with **glibc ≥ 2.25** (Ubuntu 18.04+, Debian 10+, Fedora 27+, Arch, etc.) |
| FUSE | `libfuse2` must be installed. Ubuntu 22.04+ ships fuse3 by default — run `sudo apt install libfuse2` once if the AppImage won't launch |
| Node.js | Not required — Electron bundles its own Node.js runtime |
| Internet | Required to reach the Bluesky API (`bsky.social`) |

> CentOS / RHEL 7 (glibc 2.17) is not supported.

---

## Getting Started — AppImage (recommended)

1. Download `Bluesky-Media-Feed-x.y.z.AppImage` from [Releases](https://github.com/Tamalero/PersonalBlueSkyFeed/releases/latest)
2. Make it executable:
   ```bash
   chmod +x Bluesky-Media-Feed-x.y.z.AppImage
   ```
3. Run it:
   ```bash
   ./Bluesky-Media-Feed-x.y.z.AppImage
   ```
4. Log in with your Bluesky handle or email and an **App Password** (create one at [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords))
5. Optionally check **Save credentials** to enable auto-login on future launches

---

## Credential Storage

Two formats are supported. The app tries encrypted first, then falls back to plaintext.

### Encrypted (created by the app)
When you check "Save credentials" in the login form, the app writes `credentials.enc` — an AES-256-GCM encrypted JSON file. The key is derived from your machine's hostname + username via `scrypt` and never leaves your machine.

### Plaintext (manual / advanced)
Create `credentials.txt` in the app's config directory (`~/.config/BlueSkyFeed/` when running as an AppImage):
```
handle: your.handle.bsky.social
app: xxxx-xxxx-xxxx-xxxx
```

Both files are scoped to the OS user-data directory and are never uploaded anywhere.

---

## Running in Development Mode

Requires Node.js 18+ and npm.

**Terminal 1 — Backend** (port 5000):
```bash
npm install       # install root deps (Electron + all backend deps)
cd backend
npm install       # install backend-only dev deps (nodemon)
npm start
```

**Terminal 2 — Frontend** (port 3000):
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Vite proxies all `/api/*` requests to the backend on `:5000`.

**Electron dev mode** (optional — runs the packaged window against the dev server):
```bash
npm run electron:dev
```

---

## Building and Releasing

### Build AppImage locally (no upload)
```bash
npm run dist
# Output: dist-electron/Bluesky-Media-Feed-x.y.z.AppImage
```

### Publish a new release
```bash
# Requires a GitHub personal access token with `repo` scope
export GH_TOKEN=ghp_your_token_here

# 1. Bump version in package.json
npm version patch   # or: minor | major

# 2. Build, patch, and publish
npm run release
```

`npm run release` runs: build frontend → `electron-builder --publish never` → `node scripts/release.js`.

`scripts/release.js` performs these steps automatically:
- Renames the AppImage (spaces → hyphens)
- Patches the `.upd_info` ELF section with the `gh-releases-zsync` update URL (required for GearLever)
- Generates a `.zsync` delta file via `zsyncmake`
- Recomputes sha512/size and updates `latest-linux.yml`
- Creates a GitHub Release and uploads all three assets (AppImage, .zsync, latest-linux.yml)

> Do not use `electron-builder --publish always` directly — it skips the `.upd_info` patch and GearLever will not see the update link.

---

## Security

- Uses the official Bluesky AT Protocol API (`@atproto/api`) — no unofficial endpoints
- Your credentials are sent only to `bsky.social` (never to any third party)
- Always use an **App Password**, not your main Bluesky password
- Saved credentials are AES-256-GCM encrypted with a key derived from your machine identity — the file is useless without the same machine account
- CORS is restricted to `localhost:3000` in dev; disabled entirely in production (same-origin)
- Session is in-memory — restarting the app logs you out unless credentials are saved

---

## Troubleshooting

**AppImage won't launch**
- Make sure it's executable: `chmod +x Bluesky-Media-Feed-*.AppImage`
- On Ubuntu 22.04+: `sudo apt install libfuse2`

**Login fails with "Invalid handle or password"**
- Use an **App Password**, not your main password
- Create one at [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords)
- Check your handle is correct (e.g. `you.bsky.social`)

**No posts showing**
- Make sure you follow accounts that post images or videos
- Try clicking Refresh Feed
- Bluesky's timeline may be sparse — the app scans up to 500 recent posts per page load

**Videos don't play**
- Bluesky serves video as HLS (`.m3u8`); playback requires hls.js which is bundled — no extra install needed
- If a video still won't play, use "View on Bluesky" to watch it in the browser

**GearLever shows no update link**
- Only AppImages built with `npm run release` (v1.4.1+) have the `.upd_info` section populated
- Verify with: `readelf -p .upd_info Bluesky-Media-Feed-*.AppImage`

---

## License

MIT

---

## Disclaimer

This is an unofficial Bluesky client. Use at your own discretion and in accordance with [Bluesky's terms of service](https://bsky.social/about/support/tos).
