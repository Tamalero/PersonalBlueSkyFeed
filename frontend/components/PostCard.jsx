import './PostCard.css';

function PostCard({ post, reason }) {
  const isRepost = reason && reason.$type === 'app.bsky.feed.defs#reasonRepost';
  const embedType = post.embed?.$type;

  let mediaUrl = null;
  let mediaType = 'unknown';

  // Timeline responses use #view embed types
  if (embedType === 'app.bsky.embed.images#view' && post.embed.images?.length > 0) {
    mediaUrl = post.embed.images[0].thumb;
    mediaType = 'image';
  } else if (embedType === 'app.bsky.embed.video#view') {
    mediaUrl = post.embed.thumbnail ?? null;
    mediaType = 'video';
  } else if (embedType === 'app.bsky.embed.external#view' && post.embed.external?.thumb) {
    mediaUrl = post.embed.external.thumb;
    mediaType = 'external';
  }

  const authorName = post.author.displayName || post.author.handle;
  const postTime = new Date(post.record.createdAt).toLocaleDateString();

  return (
    <div className="post-card">
      {isRepost && <div className="repost-badge">🔄 Repost</div>}
      
      <div className="post-media">
        {mediaUrl ? (
          <img src={mediaUrl} alt="Post media" className="media-image" />
        ) : (
          <div className="media-placeholder">No media available</div>
        )}
        {mediaType === 'video' && <div className="video-badge">▶ Video</div>}
      </div>

      <div className="post-info">
        <div className="post-author">
          <img src={post.author.avatar || '/default-avatar.png'} alt={authorName} className="avatar" />
          <div>
            <p className="author-name">{authorName}</p>
            <p className="author-handle">@{post.author.handle}</p>
          </div>
        </div>

        {post.record.text && (
          <p className="post-text">
            {post.record.text.length > 100
              ? post.record.text.substring(0, 100) + '...'
              : post.record.text}
          </p>
        )}

        <div className="post-stats">
          <span>❤️ {post.likeCount || 0}</span>
          <span>💬 {post.replyCount || 0}</span>
          <span>🔄 {post.repostCount || 0}</span>
        </div>

        <p className="post-date">{postTime}</p>

        <a
          href={`https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`}
          target="_blank"
          rel="noreferrer"
          className="view-link"
        >
          View on Bluesky →
        </a>
      </div>
    </div>
  );
}

export default PostCard;
