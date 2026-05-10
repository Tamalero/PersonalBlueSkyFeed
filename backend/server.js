const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { BskyAgent } = require('@atproto/api');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS only needed in dev (Vite proxy dev server on :3000)
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:3000' }));
}
app.use(express.json());

let agent = null;

// Follows cache — avoid re-fetching on every feed request
let followsCache = null;
let followsCacheTime = 0;
const FOLLOWS_CACHE_TTL = 5 * 60 * 1000;

async function getFollowsSet() {
  const now = Date.now();
  if (followsCache && now - followsCacheTime < FOLLOWS_CACHE_TTL) {
    return followsCache;
  }
  const set = new Set();
  let cursor;
  do {
    const { data } = await agent.getFollows({ actor: agent.session.did, cursor });
    for (const f of data.follows) set.add(f.did);
    cursor = data.cursor;
  } while (cursor);
  followsCache = set;
  followsCacheTime = now;
  return set;
}

// Timeline responses return view embed types (with #view suffix)
function hasMedia(post) {
  if (!post.embed) return false;
  const t = post.embed.$type;
  if (t === 'app.bsky.embed.images#view') return !!(post.embed.images?.length);
  if (t === 'app.bsky.embed.video#view') return true;
  if (t === 'app.bsky.embed.external#view') return !!(post.embed.external?.thumb);
  return false;
}

// `reason` lives on the feed item, not on feedItem.post
function isRepost(feedItem) {
  return feedItem.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
}

// For reposts: filter by the reposter (followed account who shared it).
// For originals: filter by the post author.
function getFilterAuthorDid(feedItem) {
  return isRepost(feedItem) ? feedItem.reason.by.did : feedItem.post.author.did;
}

function loadCredentials() {
  try {
    const credPath = process.env.CREDENTIALS_PATH
      || path.join(__dirname, '..', 'credentials.txt');
    const content = fs.readFileSync(credPath, 'utf-8');
    const credentials = {};
    for (const line of content.split('\n').map(l => l.trim()).filter(Boolean)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      credentials[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
    return credentials;
  } catch (error) {
    console.error('Error loading credentials:', error.message);
    return null;
  }
}

app.post('/api/auto-login', async (req, res) => {
  try {
    const credentials = loadCredentials();
    if (!credentials?.handle || !credentials?.app) {
      return res.status(400).json({ error: 'Credentials not found. Create credentials.txt with handle: and app: fields.' });
    }
    agent = new BskyAgent({ service: process.env.BLUESKY_SERVICE_URL || 'https://bsky.social' });
    await agent.login({ identifier: credentials.handle, password: credentials.app });
    res.json({ success: true, handle: credentials.handle });
  } catch (error) {
    console.error('Auto-login error:', error);
    res.status(401).json({ error: error.message || 'Auto-login failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { handle, password } = req.body;
    if (!handle || !password) {
      return res.status(400).json({ error: 'Handle and password are required' });
    }
    agent = new BskyAgent({ service: process.env.BLUESKY_SERVICE_URL || 'https://bsky.social' });
    await agent.login({ identifier: handle, password });
    res.json({ success: true, message: 'Logged in successfully' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

// Fetch pages from Bluesky until we have enough filtered posts or exhaust the timeline
const FEED_PAGE_TARGET = 20;
const FEED_MAX_PAGES = 5;

app.get('/api/feed', async (req, res) => {
  try {
    if (!agent) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }

    const followsSet = await getFollowsSet();
    const incomingCursor = req.query.cursor || undefined;

    const results = [];
    let cursor = incomingCursor;

    for (let page = 0; page < FEED_MAX_PAGES && results.length < FEED_PAGE_TARGET; page++) {
      const { data } = await agent.getTimeline({ limit: 100, cursor });
      for (const feedItem of data.feed) {
        if (hasMedia(feedItem.post) && followsSet.has(getFilterAuthorDid(feedItem))) {
          results.push(feedItem);
        }
      }
      cursor = data.cursor;
      if (!cursor) break;
    }

    res.json({ feed: results, cursor: cursor || null });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch feed' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/logout', (req, res) => {
  agent = null;
  followsCache = null;
  followsCacheTime = 0;
  res.json({ success: true, message: 'Logged out successfully' });
});

// Serve built frontend in production (Electron / standalone mode)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
