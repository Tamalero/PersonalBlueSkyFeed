import { useEffect, useRef } from 'react';
import PostCard from './PostCard';
import './FeedDisplay.css';

function FeedDisplay({ feed, loading, loadingMore, hasMore, onLoadMore, onSelectPost }) {
  const sentinelRef = useRef(null);
  // Keep a stable ref to the latest callback so the observer never needs recreation
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onLoadMoreRef.current(); },
      { rootMargin: '300px' }
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return <div className="feed-loading">Loading media posts...</div>;
  }

  if (feed.length === 0) {
    return (
      <div className="feed-empty">
        <p>No media posts found in your timeline from followed accounts.</p>
        <small>Try refreshing or follow more accounts with media posts.</small>
      </div>
    );
  }

  return (
    <div className="feed-container">
      <div className="feed-grid">
        {feed.map((item) => (
          <PostCard key={item.post.uri} post={item.post} reason={item.reason} onSelect={() => onSelectPost(item)} />
        ))}
      </div>
      <div ref={sentinelRef} className="feed-sentinel">
        {loadingMore && <div className="feed-loading-more">Loading more posts...</div>}
        {!loadingMore && hasMore && (
          <button className="feed-load-more-btn" onClick={onLoadMore}>Load More Posts</button>
        )}
        {!hasMore && <div className="feed-end">You're all caught up!</div>}
      </div>
    </div>
  );
}

export default FeedDisplay;
