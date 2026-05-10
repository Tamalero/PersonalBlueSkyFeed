# Bluesky Custom Media Feed — LLM Context Reference

## Project Overview

**Bluesky Custom Media Feed** is a full-stack web application (also packaged as a self-contained Linux AppImage) that creates a personalized Bluesky feed filtered to show only:

1. **Media posts** — images, videos, external links with thumbnails
2. **From followed accounts** — accounts the authenticated user follows
3. **Including reposts** — reposts of media content made by followed accounts

Clicking any post card opens a **lightbox modal** where the user can like, repost, and reply without leaving the app. External links (including "View on Bluesky") always open in the system browser, never inside the Electron window.

**GitHub**: https://github.com/Tamalero/PersonalBlueSkyFeed  
**Tech Stack**: Node.js + Express (Backend) | React 18 + Vite (Frontend) | Electron 30 (Desktop) | @atproto/api (Bluesky)

---

## Directory Structure

```
BlueSkyFeed/
├── backend/
│   ├── server.js             # Express API: feed filtering + all interaction endpoints
│   ├── package.json          # Backend-only deps (used for dev mode)
│   └── .env.example          # Optional env var template
│
├── frontend/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # Root component — auth, feed state, infinite scroll, modal state
│   ├── App.css
│   ├── index.html
│   ├── index.css
│   ├── vite.config.js        # Dev server on :3000, proxies /api to :5000
│   ├── package.json
│   └── components/
│       ├── LoginForm.jsx     # Manual login fallback
│       ├── LoginForm.css
│       ├── FeedDisplay.jsx   # Feed grid + IntersectionObserver infinite scroll
│       ├── FeedDisplay.css
│       ├── PostCard.jsx      # Clickable post card (opens modal on click)
│       ├── PostCard.css
│       ├── PostModal.jsx     # Lightbox: full media + like/repost/reply interactions
│       └── PostModal.css
│
├── electron/
│   └── main.js               # Electron main process: Express in-process, BrowserWindow,
│                             # auto-updates, external link routing to system browser
│
├── package.json              # ROOT — electron-builder config, all bundled deps, build/release scripts
├── credentials.txt           # NOT committed — handle + app password for auto-login
├── CONTEXT.md                # This file
├── README.md
├── setup.sh
└── .gitignore
```

---

## Running in Development Mode

**Terminal 1 — Backend** (port 5000):
```bash
cd backend
npm install
npm start
```

**Terminal 2 — Frontend** (port 3000, proxies /api to backend):
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Vite proxies all `/api/*` requests to `:5000`.

---

## Building and Releasing the AppImage

### One-time setup
```bash
# Install root deps (Electron + electron-builder + electron-updater + backend deps)
npm install
```

### Build AppImage locally (no upload)
```bash
npm run dist
# Output: dist-electron/Bluesky Media Feed-1.0.0.AppImage
```

### Publish a new release (triggers auto-updates for existing users)
```bash
# Requires a GitHub personal access token with `repo` scope
export GH_TOKEN=ghp_your_token_here

# 1. Bump version (updates package.json, creates a git tag)
npm version patch   # or: minor | major

# 2. Build AppImage + upload to GitHub Releases
npm run release
```

`npm run release` runs: build frontend → `electron-builder --publish never` → `node scripts/release.js`.

`scripts/release.js` performs the following post-build steps before publishing:
1. Renames the AppImage (spaces → hyphens): `Bluesky Media Feed-x.y.z.AppImage` → `Bluesky-Media-Feed-x.y.z.AppImage`
2. Reads the `.upd_info` ELF section offset via `readelf -S` and patches it with the gh-releases-zsync update string so GearLever (and AppImageUpdate) can detect updates
3. Runs `zsyncmake` to generate a `.zsync` delta file
4. Recomputes sha512/size of the patched AppImage and rewrites `latest-linux.yml`
5. Creates a GitHub Release (draft), uploads all three assets (AppImage, .zsync, latest-linux.yml), then publishes

Three assets are uploaded to each GitHub Release:
- `Bluesky-Media-Feed-x.y.z.AppImage` — the binary
- `Bluesky-Media-Feed-x.y.z.AppImage.zsync` — delta-update file for GearLever/AppImageUpdate
- `latest-linux.yml` — the update manifest that running instances check via electron-updater

---

## Credentials System

Two credential storage formats are supported. The backend tries the encrypted file first, then falls back to plaintext.

### Plaintext (`credentials.txt`)
**File**: `credentials.txt` in the project root (dev) or `~/.config/BlueSkyFeed/credentials.txt` (AppImage).

**Format**:
```
handle: your.handle.bsky.social
app: xxxx-xxxx-xxxx-xxxx
```

- `handle` — your Bluesky handle or email
- `app` — an App Password from https://bsky.app/settings/app-passwords (NOT your main password)

### Encrypted (`credentials.enc`)
**File**: `credentials.enc` alongside `credentials.txt`, created when the user checks "Save credentials" in the login form.

**Encryption**: AES-256-GCM. The key is derived with `scryptSync` from `hostname::username` with salt `bsf-salt-v1`, producing a 32-byte key cached in memory after first derivation. The file is JSON: `{ iv, tag, data }` (all hex-encoded).

**Security model**: Protects against theft of the file alone. Anyone with access to the same machine account can rederive the key. For a single-user personal app this is appropriate — significantly better than plaintext without requiring a master password.

Both files are excluded from git via `.gitignore`. In the packaged AppImage, `electron/main.js` sets `CREDENTIALS_PATH` to the OS user-data directory (`~/.config/BlueSkyFeed/`) before starting the server, so credentials survive app updates. The manual login form is always available as a fallback.

---

## API Endpoints

### `POST /api/auto-login`
Reads `credentials.txt` (path from `CREDENTIALS_PATH` env var, falls back to `../credentials.txt`).
- **Response**: `{ success: true, handle: "..." }`
- **Error**: `{ error: "..." }` — status 400 (missing) or 401 (wrong password)

### `POST /api/login`
Manual login fallback.
- **Request**: `{ handle: "...", password: "..." }`
- **Response**: `{ success: true, message: "..." }`

### `GET /api/feed?cursor=<optional>`
Fetches and filters the timeline. Loops through up to 5 Bluesky timeline pages (100 posts each) until 20 filtered results are collected, returns with the next cursor for infinite scroll.
- **Response**: `{ feed: [...feedItems], cursor: "..." | null }`
- Each `feedItem`: `{ post: {...}, reason: null | { $type, by: {...} } }`
- `cursor: null` means no more posts are available

### `POST /api/like`
Like a post.
- **Request**: `{ uri, cid }` — the post's URI and CID
- **Response**: `{ likeUri }` — URI of the created like record (needed to undo)

### `DELETE /api/like`
Remove a like.
- **Request**: `{ likeUri }` — URI returned from `POST /api/like`
- **Response**: `{ success: true }`

### `POST /api/repost`
Repost a post.
- **Request**: `{ uri, cid }`
- **Response**: `{ repostUri }` — URI of the created repost record (needed to undo)

### `DELETE /api/repost`
Remove a repost.
- **Request**: `{ repostUri }`
- **Response**: `{ success: true }`

### `POST /api/reply`
Post a reply.
- **Request**: `{ parentUri, parentCid, rootUri, rootCid, text }`
  - `parent` — the post being replied to directly
  - `root` — the top-level post of the thread (same as parent if the post is top-level; use `post.record.reply.root` if the post is itself a reply)
  - `text` — reply content, max 300 characters
- **Response**: `{ success: true }`

### `POST /api/save-credentials`
Encrypts and saves credentials to `credentials.enc` using AES-256-GCM with a machine-derived key.
- **Request**: `{ handle: "...", password: "..." }`
- **Response**: `{ success: true }`
- **Error**: status 400 (missing fields) or 500 (write failure)
- Called by the frontend after a successful manual login when the user checks "Save credentials". Non-blocking — a save failure does not roll back the login.

### `POST /api/logout`
Clears the session and the follows cache.
- **Response**: `{ success: true, message: "..." }`

### `GET /api/health`
- **Response**: `{ status: "ok" }`

---

## Backend Implementation — Key Details

### Credential Encryption (`getDerivedKey`, `encryptCredentials`, `decryptCredentials`)
Key derived once via `crypto.scryptSync(hostname::username, 'bsf-salt-v1', 32)` and cached in `_derivedKey`. AES-256-GCM with a random 12-byte IV per write. Output stored as JSON `{ iv, tag, data }` (hex). `loadCredentials()` checks for `credentials.enc` first, then falls back to `credentials.txt`.

### `hasMedia(post)`
Checks `post.embed.$type` for **view** embed types. The `#view` suffix is what the timeline API actually returns — the bare types (without `#view`) only appear in raw AT Protocol record objects, never in `getTimeline()` responses.
- `app.bsky.embed.images#view` — checks `images.length > 0`
- `app.bsky.embed.video#view` — always true
- `app.bsky.embed.external#view` — checks `external.thumb` exists

### `isRepost(feedItem)` / `getFilterAuthorDid(feedItem)`
`reason` lives on the **feed item**, not on `feedItem.post`. Passing `feedItem.post` to these helpers is a common AT Protocol mistake — `feedItem.post.reason` is always `undefined`.
- Repost: `feedItem.reason.$type === 'app.bsky.feed.defs#reasonRepost'`
- For reposts, filter DID is `feedItem.reason.by.did` (the followed account who reposted, not the original author)
- For originals, filter DID is `feedItem.post.author.did`

### `requireAuth(req, res)`
Shared guard for all interaction endpoints. Returns `false` and sends 401 if `agent` is null, so each endpoint can early-return cleanly.

### Follows Caching (`getFollowsSet()`)
`agent.getProfile()` does NOT return a follows list — it only returns counts. Follows are fetched via the paginated `agent.getFollows()` endpoint, stored in a `Set<DID>` for O(1) lookup, and cached in-memory for 5 minutes. Cache is invalidated on logout.

### Infinite Scroll Pagination
`/api/feed` accepts a `cursor` query parameter (the opaque cursor from the previous response). It loops through up to 5 Bluesky timeline pages (up to 500 raw posts) to accumulate 20 filtered results before returning. This guarantees a reasonable page size even when the timeline is sparse with media.

### Interaction Endpoints
All interaction endpoints (`/api/like`, `/api/repost`, `/api/reply`) use `requireAuth` and delegate directly to the corresponding `@atproto/api` agent methods:
```
agent.like(uri, cid)          → returns { uri: likeUri }
agent.deleteLike(likeUri)
agent.repost(uri, cid)        → returns { uri: repostUri }
agent.deleteRepost(repostUri)
agent.post({ text, reply: { root, parent } })
```
All `DELETE` endpoints accept a JSON body — Express's `express.json()` middleware handles this correctly.

### Static File Serving (Production / Electron)
When `NODE_ENV=production`, Express serves `frontend/dist/` as static files and catches all non-API routes with `index.html`. Electron only needs one port (5000) — no separate Vite dev server in production.

### CORS
CORS middleware is only applied in development (`NODE_ENV !== 'production'`), restricted to `http://localhost:3000`. In production (AppImage), all requests are same-origin so no CORS headers are needed.

---

## Frontend Implementation — Key Details

### `App.jsx`
State:
- `isAuthenticated` — boolean
- `feed` — array of feed items
- `loading` — boolean, true during initial fetch / refresh
- `loadingMore` — boolean, true during infinite scroll page loads
- `cursor` — opaque string from last API response, `null` when exhausted
- `hasMore` — boolean, false when cursor is null
- `autoLoginError` — string or null
- `feedError` — string or null (inline error display, replaces old `alert()` calls)
- `selectedPost` — feedItem object or null; drives the PostModal

Key methods:
- `autoLogin()` — called on mount, POSTs to `/api/auto-login`, falls back to LoginForm on failure
- `fetchFeed()` — initial / refresh: resets cursor and feed array
- `loadMore()` — appends next page using current cursor (called by FeedDisplay's IntersectionObserver)
- `handleLogout()` — POSTs to `/api/logout`, clears all state including selectedPost

`setSelectedPost` is passed directly as `onSelectPost` to `FeedDisplay`. The `<PostModal>` is rendered at the App root so it always overlays the entire UI regardless of scroll position.

### `FeedDisplay.jsx`
Props: `feed`, `loading`, `loadingMore`, `hasMore`, `onLoadMore`, `onSelectPost`

Sets up a single `IntersectionObserver` (created once via `useEffect([], [])`) watching a sentinel `<div>` appended after the grid. The observer fires `onLoadMore()` when the sentinel enters the viewport with a 300px lookahead (`rootMargin`). A `useRef` holds the latest `onLoadMore` callback so the observer never needs to be recreated when state changes.

Passes `onSelect={() => onSelectPost(item)}` to each `PostCard`.

### `PostCard.jsx`
Props: `post`, `reason`, `onSelect`

The entire card is a clickable region (`role="button"`, `cursor: pointer`, keyboard-accessible via `onKeyDown`). Clicking calls `onSelect()` to open the PostModal.

The "View on Bluesky" link uses `onClick={(e) => e.stopPropagation()}` to prevent the card click from firing when the link is clicked. The link uses `target="_blank"` which in Electron is intercepted by `setWindowOpenHandler` and routed to the system browser.

### `PostModal.jsx`
Props: `feedItem`, `onClose`

A full-screen overlay lightbox. Layout: **media panel (left, 55%) + info panel (right, 45%)**.

**Media panel** — renders based on embed type:
- `images#view` — full-size image (`img.fullsize ?? img.thumb`). Multi-image posts show ‹ › carousel buttons and a count indicator.
- `video#view` — shows the video thumbnail image with a badge ("Video — open on Bluesky to play"). HLS video playback is not attempted in-app.
- `external#view` — shows the thumbnail image and the link's title, description, and URL.

**Info panel** — author avatar + name + handle, full post text (no truncation), timestamp, stat counts (live-updating after interactions), action buttons, optional reply form, "View on Bluesky ↗" link.

**Interaction state** — initialised from the viewer context baked into the feed item at fetch time:
- `post.viewer?.like` → initial `likeUri` (non-null means already liked)
- `post.viewer?.repost` → initial `repostUri` (non-null means already reposted)

Like and repost counts are updated **optimistically** (state changes immediately before the API call completes). If the API call fails, the state is not rolled back in the current implementation (acceptable for a personal-use app).

**Reply form** — shown when the Reply button is clicked. Character counter turns red below 20 characters remaining (300-char Bluesky limit). On success, shows "Reply sent!" and collapses the form. Root/parent threading: if `post.record.reply.root` exists (the post is itself a reply), it's used as the thread root; otherwise the post is treated as the root.

**Lifecycle**:
- `ESC` key closes the modal (document-level keydown listener)
- Clicking the backdrop overlay closes the modal
- `document.body.style.overflow = 'hidden'` prevents background scroll while open; restored on unmount

### `LoginForm.jsx`
- `useEffect` syncs the `initialError` prop into local `error` state so parent re-renders with a different error message are correctly reflected
- "Save credentials" checkbox (`saveCredentials` state). On successful login with the box checked, calls `POST /api/save-credentials`. A 1200 ms delay before `onLoginSuccess()` lets the user read the save confirmation message. Save failure is non-blocking — the login still completes, but a warning is shown instead of the success message.

---

## Electron AppImage — Key Details

### `electron/main.js`
1. Sets `CREDENTIALS_PATH` (to `~/.config/BlueSkyFeed/credentials.txt`) and `NODE_ENV=production` **before** requiring `backend/server.js`
2. Requires the Express server in-process — no child process / fork needed, since Electron's main process is Node.js
3. Polls `GET /api/health` every 100 ms until the server is ready, then calls `createWindow()`
4. `createWindow()` creates the `BrowserWindow` and loads `http://localhost:5000`
5. **External link routing** — two interceptors on `win.webContents`:
   - `setWindowOpenHandler` — fires on any `target="_blank"` click; calls `shell.openExternal(url)` and returns `{ action: 'deny' }` to block Electron from opening its own window
   - `will-navigate` — fires when a link would navigate the main window; prevents default and calls `shell.openExternal(url)` for any URL that isn't `localhost:5000`
6. Auto-updater is only initialised when `app.isPackaged` is true (skipped during `electron:dev`)

### Auto-Update Flow (`electron-updater`)
On launch (after a 3-second delay so the window is fully visible before any dialog appears):
1. `autoUpdater.checkForUpdates()` downloads `latest-linux.yml` from the GitHub release
2. If a newer version exists, a native dialog asks the user to download
3. Download runs in the background (`autoDownload: false` prevents silent downloads)
4. On completion, a second dialog asks to restart
5. `autoUpdater.quitAndInstall()` replaces the AppImage file on disk and relaunches

### `package.json` (root) — electron-builder config
```json
"publish": [{ "provider": "github", "owner": "Tamalero", "repo": "PersonalBlueSkyFeed" }]
```
`electron-builder` uses this to know where to upload release assets and where running instances should check for updates. The `latest-linux.yml` manifest is always published alongside the AppImage binary.

Files bundled into the AppImage:
- `electron/main.js`
- `backend/server.js` + `backend/package.json`
- `frontend/dist/**` (built React app)
- Root `node_modules/` (all production dependencies — backend + electron-updater)
- `backend/node_modules/` is **excluded** (`!backend/node_modules/**/*`) — Node.js resolves packages up the directory tree to root `node_modules/` automatically

### AppImage Portability

The AppImage is **mostly self-contained**. What is bundled:
- Entire Electron 30 / Chromium browser engine
- Node.js runtime (Electron IS Node.js — no system Node required)
- All JS dependencies (`express`, `@atproto/api`, `hls.js`, etc.) in `app.asar`
- Graphics libs: `libEGL.so`, `libffmpeg.so`, `libGLESv2.so`
- **No native `.node` addons** — all npm packages are pure JS, so there are no arch-specific compiled bindings

**Minimum system requirement: glibc ≥ 2.25** (required by the Electron binary itself). Any mainstream distro from ~2018 onwards satisfies this. CentOS/RHEL 7 (glibc 2.17) does not.

| Distro | glibc | Supported |
|---|---|---|
| Ubuntu 18.04+ | 2.27+ | ✅ |
| Debian 10+ | 2.28+ | ✅ |
| Fedora 27+ | 2.26+ | ✅ |
| Arch Linux | 2.38+ (rolling) | ✅ |
| CentOS/RHEL 7 | 2.17 | ❌ |

**libfuse2 caveat**: Ubuntu 22.04+ ships with fuse3 by default. AppImage Type 2 needs `libfuse2`. Fix: `sudo apt install libfuse2`. This is a one-time setup step, not a portability failure.

### `.upd_info` ELF Section and GearLever

AppImage Type 2 binaries have a `.upd_info` ELF section (512 bytes). AppImage managers like **GearLever** and the **AppImageUpdate** library read this section to find the update source. `electron-builder` v24 leaves this section empty by default.

`scripts/release.js` patches the section post-build with:
```
gh-releases-zsync|Tamalero|PersonalBlueSkyFeed|latest|Bluesky-Media-Feed-*.AppImage.zsync
```
This is the `gh-releases-zsync` format: `gh-releases-zsync|owner|repo|tag|zsync-filename-pattern`. After patching, GearLever shows the update link and can download updates using zsync delta transfers.

To verify the section is correctly embedded:
```bash
readelf -p .upd_info Bluesky-Media-Feed-x.y.z.AppImage
```

---

## Bug Fixes Applied (vs. Original Code)

| # | Bug | Fix |
|---|-----|-----|
| 1 | `agent.getProfile()` was called expecting a `follows` array — it never returns one; feed was always empty | Replaced with paginated `agent.getFollows()` loop stored in a `Set` |
| 2 | `hasMedia()` checked for `app.bsky.embed.images` (record type); timeline returns `app.bsky.embed.images#view` (view type); media was never detected | Updated all three embed type strings to include `#view` suffix |
| 3 | `isRepost()` and `getAuthorUri()` were passed `feedItem.post`; `reason` lives on `feedItem`, not `feedItem.post`; repost detection always returned false | Refactored both helpers to receive the full `feedItem` |
| 4 | `credentials.txt` parser used `split(':')` — would silently truncate values containing colons | Switched to `indexOf(':')` + `slice()` |
| 5 | `alert()` used for feed errors — blocks the thread, bad UX | Replaced with `feedError` state rendered inline |
| 6 | Post text always had `...` appended regardless of length | Added length check before truncation |
| 7 | `post.author.avatar` can be `null` — caused broken image icons | Added fallback to `/default-avatar.png` |
| 8 | `LoginForm` ignored prop changes after mount (stale `useState` init) | Added `useEffect` to sync `initialError` prop into state |
| 9 | CORS was `app.use(cors())` — allowed all origins | Restricted to `localhost:3000` in dev, disabled entirely in production |
| 10 | Comment in server.js contained Cyrillic `г` in "reblог" — Unicode homograph | Fixed to Latin `g` |
| 11 | `getAuthorUri` was a misleading name — returned the reposter's DID, not the original author | Renamed to `getFilterAuthorDid` with an explanatory comment |
| 12 | External links opened inside the Electron window, requiring re-login | Added `setWindowOpenHandler` + `will-navigate` to route all external URLs to `shell.openExternal()` |
| 13 | No way to interact with posts (like, repost, reply) without leaving the app | Added `PostModal` lightbox with full interaction support |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | Express server port |
| `BLUESKY_SERVICE_URL` | `https://bsky.social` | Bluesky AT Protocol endpoint |
| `CREDENTIALS_PATH` | `../credentials.txt` (relative to backend/) | Full path to credentials file; set by Electron to `~/.config/BlueSkyFeed/credentials.txt` |
| `NODE_ENV` | — | Set to `production` by Electron; enables static file serving and disables CORS |
| `GH_TOKEN` | — | GitHub token with `repo` scope; required only when running `npm run release` |

---

## Bluesky API Reference

```javascript
const agent = new BskyAgent({ service: 'https://bsky.social' });
await agent.login({ identifier: 'handle', password: 'app-password' });

// Paginated follows list
const { data } = await agent.getFollows({ actor: agent.session.did, cursor });
// data.follows = [{ did, handle, displayName, avatar, ... }]
// data.cursor  = next page cursor or undefined

// Timeline page
const { data } = await agent.getTimeline({ limit: 100, cursor });
// data.feed   = array of feedItems
// data.cursor = next page cursor or undefined

// feedItem structure (timeline view):
feedItem.post.uri                    // "at://did:.../app.bsky.feed.post/rkey"
feedItem.post.cid                    // content ID (needed for like/repost)
feedItem.post.author.did
feedItem.post.author.handle
feedItem.post.author.avatar          // URL or null
feedItem.post.author.displayName     // may be null
feedItem.post.record.text            // post text content
feedItem.post.record.createdAt       // ISO timestamp — use this, not post.createdAt
feedItem.post.record.reply?.root     // { uri, cid } if post is a reply
feedItem.post.embed                  // embedded media view object (or undefined)
feedItem.post.embed.$type            // always has #view suffix in timeline responses:
                                     //   'app.bsky.embed.images#view'
                                     //   'app.bsky.embed.video#view'
                                     //   'app.bsky.embed.external#view'
feedItem.post.embed.images[n].thumb     // thumbnail URL
feedItem.post.embed.images[n].fullsize  // full-size URL
feedItem.post.embed.images[n].alt       // alt text
feedItem.post.embed.thumbnail        // video thumbnail URL (video#view)
feedItem.post.embed.playlist         // HLS m3u8 URL (video#view)
feedItem.post.embed.external.uri     // external link URL
feedItem.post.embed.external.thumb   // thumbnail URL (may be null)
feedItem.post.embed.external.title
feedItem.post.embed.external.description
feedItem.post.likeCount
feedItem.post.replyCount
feedItem.post.repostCount
feedItem.post.viewer?.like           // URI of the user's like record, or undefined (not liked)
feedItem.post.viewer?.repost         // URI of the user's repost record, or undefined
feedItem.reason                      // null for originals; present for reposts
feedItem.reason.$type                // 'app.bsky.feed.defs#reasonRepost'
feedItem.reason.by.did               // DID of the account who reposted
feedItem.reason.by.handle

// Interactions
const { uri: likeUri }   = await agent.like(uri, cid);
await agent.deleteLike(likeUri);

const { uri: repostUri } = await agent.repost(uri, cid);
await agent.deleteRepost(repostUri);

await agent.post({
  text: 'reply text',
  reply: {
    root:   { uri: rootUri,   cid: rootCid },    // top of thread
    parent: { uri: parentUri, cid: parentCid },  // post being replied to
  },
});
```

---

## Notes for LLMs

1. **Embed types always have `#view` suffix** in timeline/feed API responses. The bare types (e.g. `app.bsky.embed.images`) only appear in raw AT Protocol record objects, never in `getTimeline()` output.
2. **`reason` is on the feed item**, not on `feedItem.post`. `feedItem.post.reason` is always `undefined`.
3. **`getProfile()` never returns a follows list.** Use the paginated `getFollows()` endpoint.
4. **`post.createdAt` does not exist** on the post object in timeline responses. Use `post.record.createdAt`.
5. **`post.viewer` contains like/repost state** for the authenticated user. Non-null `viewer.like` means the user has liked it; the value is the like URI needed to undo.
6. **Session is in-memory** — restarting the backend logs out the current user and clears the follows cache.
7. **No database** — the backend is stateless except for the in-memory `agent`, follows cache, and their associated timestamps.
8. **Credentials path differs between dev and AppImage**: dev uses `../credentials.txt` (root of repo); AppImage uses `~/.config/BlueSkyFeed/credentials.txt`.
9. **Vite proxy** — in dev, Vite on `:3000` proxies `/api/*` to Express on `:5000`. In production (AppImage), Express serves the built frontend directly on `:5000` — no Vite.
10. **External links in Electron**: `setWindowOpenHandler` handles `target="_blank"` links; `will-navigate` handles in-window navigation. Both call `shell.openExternal()`. In the web browser, `target="_blank"` opens a new tab natively — no special handling needed.
11. **Auto-updater only runs when `app.isPackaged`** — skipped entirely in dev mode.
12. **AppImage type 2** — produced by default by `electron-builder`. Requires `libfuse2` on the host (Ubuntu 22.04+ ships fuse3; install `libfuse2` as a one-time fix).
13. **AppImage portability** — self-contained except for glibc ≥ 2.25 (any mainstream distro from 2018+). No native `.node` addons; all deps are pure JS.
14. **`.upd_info` ELF section** — `electron-builder` v24 leaves this empty. `scripts/release.js` patches it post-build with the `gh-releases-zsync` URL so GearLever can detect updates. Verify with `readelf -p .upd_info <file>.AppImage`.
15. **Publishing a release** requires `GH_TOKEN` env var and running `npm version` first. The `npm run release` script handles patching, zsync generation, and GitHub upload — do NOT use `electron-builder --publish always` as it skips the `.upd_info` patch.

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-05-09 | Initial release — media feed with infinite scroll, Electron AppImage, GitHub auto-updates |
| 1.1.0 | 2026-05-09 | PostModal lightbox with like/repost/reply; external links routed to system browser |
| 1.2.0 | 2026-05-09 | Load More button; lightbox expanded to 90% viewport; explicit auto-update URL |
| 1.3.0 | 2026-05-09 | HLS video playback in lightbox via hls.js |
| 1.3.1 | 2026-05-09 | Auto-updater fix: removed bad setFeedURL, rely on bundled app-update.yml GitHub provider |
| 1.4.0 | 2026-05-09 | Encrypted credential storage; Save credentials checkbox in login form |
| 1.4.1 | 2026-05-09 | Fix: patch `.upd_info` ELF section post-build so GearLever shows update link; add `scripts/release.js` release pipeline; generate `.zsync` for delta updates |
