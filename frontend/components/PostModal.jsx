import { useState, useEffect, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import './PostModal.css';

const MAX_CHARS = 300;

function PostModal({ feedItem, onClose }) {
  const { post, reason } = feedItem;
  const isRepost = reason?.$type === 'app.bsky.feed.defs#reasonRepost';

  // Interaction state — initialised from viewer context baked into the feed item
  const [liked, setLiked] = useState(!!post.viewer?.like);
  const [likeUri, setLikeUri] = useState(post.viewer?.like || null);
  const [reposted, setReposted] = useState(!!post.viewer?.repost);
  const [repostUri, setRepostUri] = useState(post.viewer?.repost || null);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [repostCount, setRepostCount] = useState(post.repostCount || 0);

  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState(null);
  const [replySent, setReplySent] = useState(false);

  // Image carousel
  const images = post.embed?.$type === 'app.bsky.embed.images#view' ? post.embed.images : [];
  const [imgIndex, setImgIndex] = useState(0);

  const replyRef = useRef(null);

  // Close on ESC, prevent body scroll
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Focus reply textarea when shown
  useEffect(() => {
    if (showReply) replyRef.current?.focus();
  }, [showReply]);

  const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const jsonDel = (body) => ({ method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const handleLike = async () => {
    if (liked) {
      setLiked(false); setLikeCount(c => c - 1);
      await fetch('/api/like', jsonDel({ likeUri }));
      setLikeUri(null);
    } else {
      setLiked(true); setLikeCount(c => c + 1);
      const res = await fetch('/api/like', json({ uri: post.uri, cid: post.cid }));
      const data = await res.json();
      setLikeUri(data.likeUri);
    }
  };

  const handleRepost = async () => {
    if (reposted) {
      setReposted(false); setRepostCount(c => c - 1);
      await fetch('/api/repost', jsonDel({ repostUri }));
      setRepostUri(null);
    } else {
      setReposted(true); setRepostCount(c => c + 1);
      const res = await fetch('/api/repost', json({ uri: post.uri, cid: post.cid }));
      const data = await res.json();
      setRepostUri(data.repostUri);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || replying) return;
    setReplying(true);
    setReplyError(null);
    // If the post is itself a reply, thread to its root; otherwise it is the root
    const root = post.record?.reply?.root ?? { uri: post.uri, cid: post.cid };
    const res = await fetch('/api/reply', json({
      parentUri: post.uri,
      parentCid: post.cid,
      rootUri: root.uri,
      rootCid: root.cid,
      text: replyText,
    }));
    if (res.ok) {
      setReplyText('');
      setShowReply(false);
      setReplySent(true);
    } else {
      const err = await res.json();
      setReplyError(err.error || 'Failed to send reply.');
    }
    setReplying(false);
  };

  const bskyUrl = `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`;
  const authorName = post.author.displayName || post.author.handle;
  const postDate = new Date(post.record.createdAt).toLocaleString();
  const charsLeft = MAX_CHARS - replyText.length;

  // ── Media ──────────────────────────────────────────────────────────────────
  const embedType = post.embed?.$type;
  let mediaEl = null;

  if (embedType === 'app.bsky.embed.images#view' && images.length > 0) {
    const img = images[imgIndex];
    mediaEl = (
      <div className="pm-media-wrap">
        <img src={img.fullsize ?? img.thumb} alt={img.alt || 'Post image'} className="pm-image" />
        {images.length > 1 && (
          <div className="pm-carousel">
            <button className="pm-car-btn" onClick={() => setImgIndex(i => Math.max(0, i - 1))} disabled={imgIndex === 0}>‹</button>
            <span className="pm-car-count">{imgIndex + 1} / {images.length}</span>
            <button className="pm-car-btn" onClick={() => setImgIndex(i => Math.min(images.length - 1, i + 1))} disabled={imgIndex === images.length - 1}>›</button>
          </div>
        )}
      </div>
    );
  } else if (embedType === 'app.bsky.embed.video#view') {
    mediaEl = (
      <div className="pm-media-wrap">
        <VideoPlayer src={post.embed.playlist} poster={post.embed.thumbnail} />
      </div>
    );
  } else if (embedType === 'app.bsky.embed.external#view') {
    const ext = post.embed.external;
    mediaEl = (
      <div className="pm-media-wrap pm-external">
        {ext.thumb && <img src={ext.thumb} alt={ext.title || 'External'} className="pm-image" />}
        <div className="pm-ext-info">
          {ext.title && <p className="pm-ext-title">{ext.title}</p>}
          {ext.description && <p className="pm-ext-desc">{ext.description}</p>}
          <a href={ext.uri} target="_blank" rel="noreferrer" className="pm-ext-link">{ext.uri}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-box" onClick={(e) => e.stopPropagation()}>

        {/* Close */}
        <button className="pm-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Left — media */}
        <div className="pm-left">
          {mediaEl ?? <div className="pm-no-media">No media</div>}
        </div>

        {/* Right — info + actions */}
        <div className="pm-right">
          {isRepost && (
            <div className="pm-repost-label">🔁 Reposted by @{reason.by.handle}</div>
          )}

          {/* Author */}
          <div className="pm-author">
            <img src={post.author.avatar || '/default-avatar.png'} alt={authorName} className="pm-avatar" />
            <div>
              <p className="pm-author-name">{authorName}</p>
              <p className="pm-author-handle">@{post.author.handle}</p>
            </div>
          </div>

          {/* Post text */}
          {post.record.text && (
            <p className="pm-text">{post.record.text}</p>
          )}

          <p className="pm-date">{postDate}</p>

          {/* Stats */}
          <div className="pm-stats">
            <span>❤️ {likeCount}</span>
            <span>🔁 {repostCount}</span>
            <span>💬 {post.replyCount || 0}</span>
          </div>

          {/* Action buttons */}
          <div className="pm-actions">
            <button
              className={`pm-btn${liked ? ' pm-btn--liked' : ''}`}
              onClick={handleLike}
              title={liked ? 'Unlike' : 'Like'}
            >
              {liked ? '❤️' : '🤍'} {liked ? 'Liked' : 'Like'}
            </button>

            <button
              className={`pm-btn${reposted ? ' pm-btn--reposted' : ''}`}
              onClick={handleRepost}
              title={reposted ? 'Undo repost' : 'Repost'}
            >
              🔁 {reposted ? 'Reposted' : 'Repost'}
            </button>

            <button
              className={`pm-btn${showReply ? ' pm-btn--active' : ''}`}
              onClick={() => setShowReply(r => !r)}
              title="Reply"
            >
              💬 Reply
            </button>
          </div>

          {/* Reply form */}
          {showReply && (
            <div className="pm-reply-form">
              <textarea
                ref={replyRef}
                className="pm-reply-ta"
                placeholder="Write your reply…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value.slice(0, MAX_CHARS))}
                rows={3}
              />
              <div className="pm-reply-meta">
                <span className={`pm-chars${charsLeft < 20 ? ' pm-chars--warn' : ''}`}>{charsLeft}</span>
                <button
                  className="pm-send-btn"
                  onClick={handleReply}
                  disabled={replying || !replyText.trim() || charsLeft < 0}
                >
                  {replying ? 'Sending…' : 'Send Reply'}
                </button>
              </div>
              {replyError && <p className="pm-reply-error">{replyError}</p>}
            </div>
          )}

          {replySent && !showReply && (
            <p className="pm-reply-sent">Reply sent!</p>
          )}

          {/* View on Bluesky — opens system browser via Electron shell / target=_blank in browser */}
          <a href={bskyUrl} target="_blank" rel="noreferrer" className="pm-bsky-link">
            View on Bluesky ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default PostModal;
