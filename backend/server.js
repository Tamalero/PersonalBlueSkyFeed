const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
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

// ── Credential encryption (AES-256-GCM, key derived from machine identity) ──

let _derivedKey = null;
function getDerivedKey() {
  if (_derivedKey) return _derivedKey;
  let id;
  try { id = `${os.hostname()}::${os.userInfo().username}`; }
  catch { id = os.hostname() || 'bluesky-media-feed'; }
  _derivedKey = crypto.scryptSync(id, 'bsf-salt-v1', 32);
  return _derivedKey;
}

function encryptCredentials(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getDerivedKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: enc.toString('hex'),
  });
}

function decryptCredentials(json) {
  const { iv, tag, data } = JSON.parse(json);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getDerivedKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8');
}

function getCredPaths() {
  const txt = process.env.CREDENTIALS_PATH || path.join(__dirname, '..', 'credentials.txt');
  // Encrypted file lives alongside the plaintext file
  const enc = path.join(path.dirname(txt), 'credentials.enc');
  return { txt, enc };
}

function parseCredentialContent(content) {
  const creds = {};
  for (const line of content.split('\n').map(l => l.trim()).filter(Boolean)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    creds[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return creds;
}

function loadCredentials() {
  try {
    const { txt, enc } = getCredPaths();
    if (fs.existsSync(enc)) {
      return parseCredentialContent(decryptCredentials(fs.readFileSync(enc, 'utf-8')));
    }
    return parseCredentialContent(fs.readFileSync(txt, 'utf-8'));
  } catch (err) {
    console.error('Error loading credentials:', err.message);
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

app.post('/api/save-credentials', (req, res) => {
  try {
    const { handle, password } = req.body;
    if (!handle || !password) return res.status(400).json({ error: 'Handle and password required' });
    const { enc } = getCredPaths();
    fs.writeFileSync(enc, encryptCredentials(`handle: ${handle}\napp: ${password}\n`), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    console.error('Save credentials error:', err.message);
    res.status(500).json({ error: 'Failed to save credentials' });
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

function requireAuth(req, res) {
  if (!agent) { res.status(401).json({ error: 'Not authenticated' }); return false; }
  return true;
}

app.post('/api/like', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const { uri, cid } = req.body;
    const { uri: likeUri } = await agent.like(uri, cid);
    res.json({ likeUri });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/like', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    await agent.deleteLike(req.body.likeUri);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/repost', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const { uri, cid } = req.body;
    const { uri: repostUri } = await agent.repost(uri, cid);
    res.json({ repostUri });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/repost', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    await agent.deleteRepost(req.body.repostUri);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reply', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const { parentUri, parentCid, rootUri, rootCid, text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Reply text is required' });
    await agent.post({
      text: text.trim(),
      reply: {
        root: { uri: rootUri, cid: rootCid },
        parent: { uri: parentUri, cid: parentCid },
      },
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
