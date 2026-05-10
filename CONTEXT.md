# Bluesky Custom Media Feed — LLM Context Reference

## Project Overview

**Bluesky Custom Media Feed** is a full-stack web application (also packaged as a self-contained Linux AppImage) that creates a personalized Bluesky feed filtered to show only:

1. **Media posts** — images, videos, external links with thumbnails
2. **From followed accounts** — accounts the authenticated user follows
3. **Including reposts** — reposts of media content made by followed accounts

**GitHub**: https://github.com/Tamalero/PersonalBlueSkyFeed

**Tech Stack**: Node.js + Express (Backend) | React 18 + Vite (Frontend) | Electron 30 (Desktop) | @atproto/api (Bluesky)

---

## Directory Structure

```
BlueSkyFeed/
├── backend/
│   ├── server.js           # Express API + feed filtering logic
│   ├── package.json        # Backend-only deps (used for dev)
│   └── .env.example        # Optional env var template
│
├── frontend/
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # Root component — auth, feed state, infinite scroll
│   ├── App.css
│   ├── index.html
│   ├── index.css
│   ├── vite.config.js      # Dev server on :3000, proxies /api to :5000
│   ├── package.json
│   └── components/
│       ├── LoginForm.jsx   # Manual login fallback
│       ├── LoginForm.css
│       ├── FeedDisplay.jsx # Feed grid + IntersectionObserver infinite scroll
│       ├── FeedDisplay.css
│       ├── PostCard.jsx    # Individual post card
│       └── PostCard.css
│
├── electron/
│   └── main.js             # Electron main process: runs Express in-process,
│                           # creates BrowserWindow, manages auto-updates
│
├── package.json            # ROOT — electron-builder config, all bundled deps,
│                           # build/release scripts
├── credentials.txt         # NOT committed — handle + app password for auto-login
├── CONTEXT.md              # This file
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
# Install root deps (Electron + electron-builder + electron-updater)
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

`npm run release` builds the frontend, packages the AppImage, and publishes two assets to the GitHub Release:
- `Bluesky.Media.Feed-x.y.z.AppImage` — the binary
- `latest-linux.yml` — the update manifest that running instances check

---

## Credentials System

**File**: `credentials.txt` in the project root (dev) or `~/.config/BlueSkyFeed/credentials.txt` (AppImage).

**Format**:
```
handle: your.handle.bsky.social
app: xxxx-xxxx-xxxx-xxxx
```

- `handle` — your Bluesky handle or email
- `app` — an App Password created at https://bsky.app/settings/app-passwords (NOT your main password)

The file is excluded from git via `.gitignore`. In the packaged AppImage, `electron/main.js` sets `CREDENTIALS_PATH` to the OS user-data directory (`~/.config/BlueSkyFeed/`) before starting the server, so credentials survive app updates. The manual login form is always available as a fallback.

---

## API Endpoints

### `POST /api/auto-login`
Reads `credentials.txt` (path from `CREDENTIALS_PATH` env var or `../credentials.txt`).
- **Response**: `{ success: true, handle: "..." }`
- **Error**: `{ error: "..." }` with status 400 or 401

### `POST /api/login`
Manual login fallback.
- **Request**: `{ handle: "...", password: "..." }`
- **Response**: `{ success: true, message: "..." }`

### `GET /api/feed?cursor=<optional>`
Fetches and filters the timeline. Loops through up to 5 Bluesky timeline pages (100 posts each) until 20 filtered results are collected, then returns with the next cursor.
- **Response**: `{ feed: [...feedItems], cursor: "..." | null }`
- Each `feedItem`: `{ post: {...}, reason: null | { $type, by: {...} } }`
- `cursor: null` means no more posts available

### `POST /api/logout`
Clears the session and the follows cache.
- **Response**: `{ success: true, message: "..." }`

### `GET /api/health`
- **Response**: `{ status: "ok" }`

---

## Backend Implementation — Key Details

### `hasMedia(post)`
Checks `post.embed.$type` for **view** embed types (the `#view` suffix is what the timeline API actually returns — the record types without `#view` only appear in raw AT Protocol records):
- `app.bsky.embed.images#view` — checks `images.length > 0`
- `app.bsky.embed.video#view` — always true
- `app.bsky.embed.external#view` — checks `external.thumb` exists

### `isRepost(feedItem)` / `getFilterAuthorDid(feedItem)`
`reason` lives on the **feed item**, not on `feedItem.post`. This is a common AT Protocol mistake.
- Repost: `feedItem.reason.$type === 'app.bsky.feed.defs#reasonRepost'`
- For reposts, the DID to filter against is `feedItem.reason.by.did` (the followed account who reposted)
- For originals, it is `feedItem.post.author.did`

### Follows Caching (`getFollowsSet()`)
`agent.getProfile()` does NOT return a follows list — it only returns counts. Follows are fetched via the paginated `agent.getFollows()` endpoint and cached in-memory for 5 minutes. Cache is cleared on logout.

### Infinite Scroll Pagination
The `/api/feed` endpoint accepts a `cursor` query parameter (the opaque cursor from the previous response) and loops through up to 5 Bluesky timeline pages (up to 500 raw posts) to accumulate 20 filtered results. This guarantees a reasonable number of visible posts even if the timeline is sparse with media.

### Static File Serving (Production / Electron)
When `NODE_ENV=production`, Express serves `frontend/dist/` as static files and catches all non-API routes with `index.html`. This means Electron only needs one port (5000) — no separate Vite dev server.

### CORS
CORS middleware is only applied in development (`NODE_ENV !== 'production'`), restricted to `http://localhost:3000`. In production, same-origin requests from the Electron window need no CORS headers.

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
- `feedError` — string or null (replaces the old `alert()` calls)

Key methods:
- `autoLogin()` — called on mount, POSTs to `/api/auto-login`, falls back to LoginForm
- `fetchFeed()` — initial / refresh: resets cursor, replaces feed array
- `loadMore()` — appends next page using current cursor
- `handleLogout()` — POSTs to `/api/logout`, clears all state

### `FeedDisplay.jsx`
Sets up a single `IntersectionObserver` (created once, stable) watching a sentinel `<div>` appended after the grid. The observer fires `onLoadMore()` when the sentinel enters the viewport with a 300px lookahead. A `useRef` holds the latest `onLoadMore` callback so the observer never needs to be recreated when state changes.

### `PostCard.jsx`
- Uses `#view` embed type strings to match what the timeline API returns
- Avatar fallback: `/default-avatar.png` when `post.author.avatar` is null
- Truncates post text only when it exceeds 100 characters (previously always appended `...`)
- Date from `post.record.createdAt` (the correct field; `post.createdAt` doesn't exist on the post object)

### `LoginForm.jsx`
- `useEffect` syncs the `initialError` prop into local `error` state so re-renders from the parent correctly update the displayed error

---

## Electron AppImage — Key Details

### `electron/main.js`
- Sets `CREDENTIALS_PATH` and `NODE_ENV=production` before requiring `backend/server.js`
- Requires the Express server in-process (no child process / fork needed — Electron's main process is Node.js)
- Polls `GET /api/health` every 100 ms until the server is ready, then opens the `BrowserWindow`
- Auto-updater is only initialized when `app.isPackaged` is true (skipped in dev / `electron:dev`)

### Auto-Update Flow (`electron-updater`)
On launch (after 3 seconds):
1. `autoUpdater.checkForUpdates()` fetches `latest-linux.yml` from the GitHub release
2. If a newer version exists, a native dialog asks the user to download
3. Download runs in the background
4. On completion, a second dialog asks to restart
5. `autoUpdater.quitAndInstall()` replaces the current AppImage file and restarts

`autoDownload: false` ensures the user is always asked before bandwidth is consumed.

### `package.json` (root) — electron-builder config
```json
"publish": [{ "provider": "github", "owner": "Tamalero", "repo": "PersonalBlueSkyFeed" }]
```
`electron-builder` uses this to know where to upload and where running instances should check for updates. The `latest-linux.yml` update manifest is always published alongside the AppImage binary.

Files bundled into the AppImage:
- `electron/main.js`
- `backend/server.js` + `backend/package.json`
- `frontend/dist/**` (built React app)
- Root `node_modules/` (all production dependencies)
- Backend's own `node_modules/` is excluded (`!backend/node_modules/**/*`) — Node.js resolves packages up the directory tree to root `node_modules/`

---

## Bug Fixes Applied (vs. Original Code)

| # | Bug | Fix |
|---|-----|-----|
| 1 | `agent.getProfile()` was called expecting a `follows` array — it never returns one. Feed was always empty. | Replaced with paginated `agent.getFollows()` loop stored in a `Set` |
| 2 | `hasMedia()` checked for `app.bsky.embed.images` (record type). Timeline returns `app.bsky.embed.images#view` (view type). Media was never detected. | Updated all three embed type strings to include `#view` suffix |
| 3 | `isRepost()` and `getAuthorUri()` were passed `feedItem.post`. The `reason` field lives on `feedItem`, not `feedItem.post` — repost detection always returned false. | Refactored both helpers to receive `feedItem` directly |
| 4 | `credentials.txt` parser used `split(':')` — would silently truncate values containing colons | Switched to `indexOf(':')` + `slice()` |
| 5 | `alert()` used for feed errors — blocks the thread, terrible UX | Replaced with `feedError` state rendered inline |
| 6 | Post text always had `...` appended regardless of length | Added length check before truncation |
| 7 | `post.author.avatar` can be `null` — caused broken image icons | Added fallback to `/default-avatar.png` |
| 8 | `LoginForm` ignored prop changes after mount (stale `useState` init) | Added `useEffect` to sync `initialError` prop into state |
| 9 | CORS was `app.use(cors())` — allowed all origins | Restricted to `localhost:3000` in dev, disabled in production |
| 10 | Comment contained Cyrillic `г` in "reblог" — Unicode homograph | Fixed to Latin `g` |
| 11 | `getAuthorUri` was a misleading name — it returned the reposter's DID, not the original author | Renamed to `getFilterAuthorDid` with an explanatory comment |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | Express server port |
| `BLUESKY_SERVICE_URL` | `https://bsky.social` | Bluesky AT Protocol endpoint |
| `CREDENTIALS_PATH` | `../credentials.txt` (relative to backend/) | Full path to credentials file; set by Electron to `~/.config/BlueSkyFeed/credentials.txt` |
| `NODE_ENV` | — | Set to `production` by Electron before requiring server; enables static file serving and disables CORS |
| `GH_TOKEN` | — | GitHub token with `repo` scope; required only when running `npm run release` |

---

## Bluesky API Reference

```javascript
const agent = new BskyAgent({ service: 'https://bsky.social' });
await agent.login({ identifier: 'handle', password: 'app-password' });

// Get paginated follows list
const { data } = await agent.getFollows({ actor: agent.session.did, cursor });
// data.follows = [{ did, handle, displayName, ... }]
// data.cursor = next page cursor or undefined

// Get timeline page
const { data } = await agent.getTimeline({ limit: 100, cursor });
// data.feed = array of feedItems
// data.cursor = next page cursor or undefined

// feedItem structure:
feedItem.post.uri              // "at://did:.../app.bsky.feed.post/..."
feedItem.post.author.did       // author DID
feedItem.post.author.handle
feedItem.post.author.avatar    // URL or null
feedItem.post.author.displayName
feedItem.post.record.text      // post text content
feedItem.post.record.createdAt // ISO timestamp (correct field)
feedItem.post.embed            // embedded media view object (or undefined)
feedItem.post.embed.$type      // 'app.bsky.embed.images#view' | 'app.bsky.embed.video#view' | 'app.bsky.embed.external#view' | ...
feedItem.post.likeCount
feedItem.post.replyCount
feedItem.post.repostCount
feedItem.reason                // null for originals; repost metadata object for reposts
feedItem.reason.$type          // 'app.bsky.feed.defs#reasonRepost'
feedItem.reason.by.did         // DID of the account who reposted
```

---

## Notes for LLMs

1. **Embed types always have `#view` suffix** in timeline/feed API responses. The bare types (e.g. `app.bsky.embed.images`) only appear in raw AT Protocol records, not in `getTimeline()` output.
2. **`reason` is on the feed item**, not on `feedItem.post`. `feedItem.post.reason` is always `undefined`.
3. **`getProfile()` never returns follows**. Use `getFollows()` with pagination.
4. **Session is in-memory** — restarting the backend logs out the current user and clears the follows cache.
5. **No database** — the backend is stateless except for the in-memory `agent` and follows cache.
6. **Credentials path differs between dev and AppImage**: dev uses `../credentials.txt` (root of repo), AppImage uses `~/.config/BlueSkyFeed/credentials.txt`.
7. **Vite proxy** — in dev, Vite on `:3000` proxies `/api/*` to Express on `:5000`. In production (AppImage), Express serves the built frontend directly on `:5000` — no Vite.
8. **Auto-updater only runs when `app.isPackaged`** — it is skipped entirely in dev mode.
9. **AppImage type 2** — produced by default by `electron-builder`. Requires FUSE on the host system.
10. **Publishing a release** requires `GH_TOKEN` env var and `npm version` to be run first to bump the version tag.

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-05-09 | Initial release — media feed with infinite scroll, Electron AppImage, auto-updates |
