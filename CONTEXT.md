# Bluesky Custom Media Feed - LLM Context Reference

## Project Overview

**Bluesky Custom Media Feed** is a full-stack web application that creates a personalized Bluesky feed filtered to show only:
1. **Media posts** (images, videos, external media)
2. **From followed accounts** (accounts the user follows)
3. **Including reposts** (reposts/reblogs of media from followed accounts)

**Tech Stack**: Node.js + Express (Backend) | React 18 + Vite (Frontend) | @atproto/api (Bluesky Integration)

---

## Architecture Overview

```
BlueSkyFeed (Root)
├── backend/                 # Node.js Express API Server (Port 5000)
│   ├── server.js           # Main application logic
│   ├── package.json        # Dependencies
│   ├── .env.example        # Configuration template
│   └── node_modules/       # Installed packages
│
├── frontend/               # React + Vite Web App (Port 3000)
│   ├── main.jsx           # React entry point
│   ├── App.jsx            # Main app component with auto-login
│   ├── index.html         # HTML template
│   ├── vite.config.js     # Build configuration
│   ├── package.json       # Dependencies
│   ├── components/        # Reusable React components
│   │   ├── LoginForm.jsx  # Login form (fallback)
│   │   ├── FeedDisplay.jsx # Feed grid layout
│   │   └── PostCard.jsx   # Individual post card
│   └── [various .css files]
│
├── .github/
│   └── copilot-instructions.md  # Development instructions
│
├── .vscode/
│   └── tasks.json         # VS Code build tasks
│
├── credentials.txt        # User credentials (handle + app password)
├── README.md             # User-facing documentation
├── setup.sh              # Quick setup script
└── .gitignore            # Git ignore rules
```

---

## Key Features & Implementation

### 1. **Secure Authentication**
- Uses Bluesky App Passwords (never main password)
- Credentials stored in `credentials.txt` (format: `handle: X` and `app: Y`)
- Backend handles all authentication with `@atproto/api` library
- Two auth methods: Auto-login (from file) and manual login (form)

### 2. **Feed Filtering Logic** (backend/server.js)

**Helper Functions:**
- `hasMedia(post)` - Detects posts with images, videos, or external media
  - Checks `post.embed.$type` for: `app.bsky.embed.images`, `app.bsky.embed.video`, `app.bsky.embed.external`
  - Returns `true` only if embed exists and contains media

- `isRepost(post)` - Identifies reposts
  - Checks if `post.reason.$type === 'app.bsky.feed.defs#reasonRepost'`

- `getAuthorUri(post)` - Gets the actual author (handles reposts)
  - If repost: returns `post.reason.by.did`
  - If original: returns `post.author.did`

**Feed Filtering Algorithm:**
1. Fetch user's followed accounts via `agent.getProfile({})`
2. Fetch timeline with `agent.getTimeline({ limit: 100 })`
3. Filter each post:
   - Must have media (via `hasMedia()`)
   - Author must be in user's follows list
4. Return filtered feed as JSON array

### 3. **Auto-Login Flow**
- Frontend (`App.jsx`) calls `/api/auto-login` on mount
- Backend reads `credentials.txt`, extracts handle + app password
- Logs in automatically, frontend fetches feed
- Falls back to manual login form if auto-login fails

### 4. **API Endpoints**

**POST `/api/auto-login`**
- Reads credentials from `credentials.txt`
- Returns: `{ success: true, handle: "..." }`
- No request body needed

**POST `/api/login`**
- Manual login fallback
- Request: `{ handle: "...", password: "..." }`
- Returns: `{ success: true, message: "..." }`

**GET `/api/feed`**
- Requires authentication (agent must be logged in)
- Returns: `{ feed: [{ post: {...}, reason: null|{...} }, ...] }`
- Each item has:
  - `post`: Full post object with embed info
  - `reason`: Repost metadata (null if original post)

**POST `/api/logout`**
- Clears authenticated session
- Returns: `{ success: true, message: "..." }`

**GET `/api/health`**
- Simple health check
- Returns: `{ status: "ok" }`

---

## Frontend Components

### **App.jsx** (Main Component)
```
Responsibilities:
- Auto-login on mount (tries /api/auto-login)
- Manage authentication state (isAuthenticated)
- Manage feed data (feed array)
- Handle loading states
- Switch between login form and feed display
```

Props/State:
- `isAuthenticated` - Boolean, true after login
- `feed` - Array of feed items
- `loading` - Boolean, true while fetching
- `autoLoginError` - String or null

Methods:
- `autoLogin()` - Attempts auto-login, sets state on success/failure
- `fetchFeed()` - Calls `/api/feed`, updates state
- `handleLoginSuccess()` - Sets authenticated state, fetches feed
- `handleLogout()` - Calls `/api/logout`, clears state

### **LoginForm.jsx** (Fallback Login)
```
Props:
- onLoginSuccess(callback) - Called after successful login
- error (optional) - Error message from auto-login attempt

Features:
- Handle/email input
- Password input with security notes
- Error message display
- Loading state during submission
```

### **FeedDisplay.jsx** (Feed Container)
```
Props:
- feed (array) - Array of feed items
- loading (boolean) - Show loading state

Shows:
- Grid of PostCard components if posts exist
- Empty state message if no posts
- Loading spinner during fetch
```

### **PostCard.jsx** (Individual Post)
```
Props:
- post (object) - Post data
- reason (object|null) - Repost metadata

Features:
- Display media thumbnail
- Show video badge for videos
- Show repost badge if reposted
- Author info with avatar
- Post text snippet
- Stats (likes, replies, reposts)
- Direct link to Bluesky
- Responsive grid layout
```

---

## Backend Implementation Details

### **Media Detection Logic**
```javascript
// Handles three types of media:
1. Images: embed.$type === 'app.bsky.embed.images'
2. Videos: embed.$type === 'app.bsky.embed.video'
3. External: embed.$type === 'app.bsky.embed.external' (with thumbnail)
```

### **Follow-Based Filtering**
```javascript
// User's follows come from:
const followsDid = userProfile.follows
// This is an array of follow objects with .did properties

// Check if post author is in follows:
const isFromFollowed = followsDid.some(follow => follow.did === authorDid)
```

### **Repost Handling**
```javascript
// Original posts vs reposts handled transparently:
if (isRepost(post)) {
  authorDid = post.reason.by.did  // Get reposter's ID
} else {
  authorDid = post.author.did     // Get author's ID
}
// Both filtered the same way - shows media regardless of source
```

---

## Credentials System

**File**: `credentials.txt` (root directory)

**Format**:
```
handle: tamalero.bsky.social
app: qp6w-auc4-2g6m-moma
```

**Security Notes**:
- App password ≠ main Bluesky password
- Created at https://bsky.app/settings/app-passwords
- Only backend reads this file
- Add to `.gitignore` to prevent accidental commits
- In production, use environment variables instead

---

## Running the Application

### **Terminal 1 - Backend**
```bash
cd backend
npm start
# Runs on http://localhost:5000
```

### **Terminal 2 - Frontend**
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000 with hot reload
# Vite configured to proxy /api requests to backend
```

### **VS Code Build Task**
```bash
Ctrl+Shift+B (or Cmd+Shift+B on Mac)
Select "Full Stack: Start Both Servers"
# Runs both backend and frontend in parallel
```

---

## Development Workflow

### **Making API Changes**
1. Edit `/backend/server.js`
2. Backend auto-restarts (if using nodemon)
3. Frontend proxy automatically uses new endpoints

### **Making Frontend Changes**
1. Edit React files in `/frontend`
2. Vite hot-reloads automatically
3. No need to restart

### **Adding New Feed Filters**
1. Add helper function in `server.js` (e.g., `filterByDate()`)
2. Add to filtering logic in `/api/feed` endpoint
3. Test by calling endpoint

### **Testing Feed Logic**
1. Backend logs fetch attempts
2. Check browser console for frontend errors
3. Network tab shows API responses

---

## Common Scenarios & Solutions

### **Scenario 1: Auto-login fails**
- Check `credentials.txt` format
- Verify handle and app password are correct
- Ensure app password hasn't been revoked on Bluesky
- Frontend falls back to manual login form
- Check backend console for error details

### **Scenario 2: Empty feed**
- User may not follow accounts with media posts
- Post embeds may not be recognized by `hasMedia()`
- Check backend `/api/feed` response in DevTools
- Verify `followsDid` is populated correctly

### **Scenario 3: Port conflicts**
- Backend (5000): Kill with `kill $(lsof -t -i:5000)`
- Frontend (3000): Kill with `kill $(lsof -t -i:3000)`
- Or change in `.env` / `vite.config.js`

### **Scenario 4: CORS errors**
- Backend has `app.use(cors())` enabled
- Vite proxy configured for `/api` requests
- If still failing, check network tab for actual error

---

## State Flow Diagram

```
App Component Mount
        ↓
   Auto-login Called
        ↓
    [Two paths]
    ├→ Success → Set isAuthenticated=true → Fetch Feed → Show Feed
    └→ Fail    → Show LoginForm (with error message)
        ↓
   [Manual Login if needed]
        ↓
   Set isAuthenticated=true → Fetch Feed → Show Feed
        ↓
   User clicks Refresh → Fetch Feed → Update Feed Array
        ↓
   User clicks Logout → Clear Session → Show LoginForm
```

---

## Key Files to Modify for Common Tasks

| Task | File | Key Method/Section |
|------|------|-------------------|
| Change filter logic | `backend/server.js` | `/api/feed` endpoint, filtering loop |
| Add new login method | `backend/server.js` | Add new `app.post()` endpoint |
| Modify UI layout | `frontend/App.jsx` | JSX structure |
| Add new component | `frontend/components/` | Create `.jsx` and corresponding `.css` |
| Change styling | `frontend/components/*.css` | Edit CSS classes |
| Add environment variables | `backend/.env` | Add key=value pairs |
| Modify feed request | `frontend/App.jsx` | `fetchFeed()` method |
| Change post display | `frontend/components/PostCard.jsx` | JSX and CSS |

---

## Environment & Dependencies

### **Backend Dependencies**
- `express` - HTTP server
- `cors` - Cross-Origin Resource Sharing
- `dotenv` - Environment variables
- `@atproto/api` - Official Bluesky API client

### **Frontend Dependencies**
- `react` - UI library
- `react-dom` - DOM rendering
- `vite` - Build tool & dev server
- `@vitejs/plugin-react` - React plugin for Vite

### **Environment Variables** (Optional)
```
PORT=5000 (backend server port)
BLUESKY_SERVICE_URL=https://bsky.social (Bluesky API endpoint)
```

---

## Production Considerations

1. **Credentials Storage**: Replace `credentials.txt` with environment variables
2. **Session Management**: Implement proper session/database storage
3. **HTTPS**: Enable HTTPS in production
4. **Rate Limiting**: Add rate limiting to API endpoints
5. **Error Logging**: Implement proper logging system
6. **Frontend Build**: Run `npm run build` in frontend for optimized dist/
7. **Backend**: Add authentication middleware to protect endpoints
8. **Caching**: Implement feed caching to reduce API calls

---

## Bluesky API Reference

**@atproto/api Classes & Methods:**

```javascript
// Create agent
const agent = new BskyAgent({ service: 'https://bsky.social' })

// Login
await agent.login({ identifier: 'handle', password: 'password' })

// Get user profile with follows
const profile = await agent.getProfile({})
// profile.follows = array of follow objects with .did property

// Get timeline
const { data } = await agent.getTimeline({ limit: 100 })
// data.feed = array of feed items

// Post structure
post.uri              // Unique identifier
post.author.handle    // Username
post.author.did       // Decentralized ID
post.author.avatar    // Avatar URL
post.record.text      // Post text content
post.embed            // Embedded media (if any)
post.createdAt        // ISO timestamp
post.likeCount        // Number of likes
post.replyCount       // Number of replies
post.repostCount      // Number of reposts

// Embed types
post.embed.$type
// - app.bsky.embed.images      (images)
// - app.bsky.embed.video        (video)
// - app.bsky.embed.external     (external links)

// Repost detection
post.reason?.$type === 'app.bsky.feed.defs#reasonRepost'
post.reason.by.did  // Reposter's DID
```

---

## File Size & Performance Notes

- Frontend bundle: ~50KB (React + Vite optimized)
- Backend: Lightweight Express server
- Feed limit: 100 posts per request (configurable)
- No database: In-memory session (restart clears)
- CSS: Responsive grid, minimal animations

---

## Common Debugging Commands

```bash
# Check if backend is running
curl http://localhost:5000/api/health

# Check backend logs (in terminal running backend)
# Errors appear in real-time

# Check frontend console
# Browser DevTools > Console tab

# Test API endpoint directly
curl -X GET http://localhost:5000/api/feed \
  -H "Authorization: Bearer ..." 
# (Won't work without auth, use actual token)

# List open ports
lsof -i :5000  # Backend
lsof -i :3000  # Frontend
```

---

## Version & Date

- **Created**: May 9, 2026
- **Latest Updated**: May 9, 2026
- **Node Version**: 16+
- **React Version**: 18
- **Vite Version**: 4.3.0

---

## Notes for LLMs

1. **Session is in-memory**: Restarting backend logs out current user
2. **Credentials file**: Required for auto-login, format is strict
3. **Feed filtering is client-agnostic**: Works with any Bluesky client
4. **CORS enabled by default**: Safe for local development
5. **No database**: Stateless backend except for session
6. **Vite proxy**: Seamlessly forwards `/api/*` to backend
7. **Error handling**: Both frontend and backend provide useful error messages
8. **Responsive design**: Mobile-friendly CSS grid layout
9. **Component architecture**: Each component has single responsibility
10. **API is REST**: Standard HTTP methods, JSON responses

---

## Future Enhancement Opportunities

- [ ] Database integration (PostgreSQL/MongoDB)
- [ ] User preferences/settings storage
- [ ] Advanced filtering (date range, media type toggle)
- [ ] Dark mode
- [ ] Export feed as RSS
- [ ] Caching layer with Redis
- [ ] Multiple user support
- [ ] Feed scheduling
- [ ] Desktop app (Electron)
- [ ] Mobile app (React Native)
