import { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import FeedDisplay from './components/FeedDisplay';
import PostModal from './components/PostModal';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [autoLoginError, setAutoLoginError] = useState(null);
  const [feedError, setFeedError] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    autoLogin();
  }, []);

  const autoLogin = async () => {
    try {
      const response = await fetch('/api/auto-login', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        console.log('Auto-logged in as:', data.handle);
        setIsAuthenticated(true);
        await fetchFeed();
      } else {
        setAutoLoginError('Auto-login failed. Please login manually.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Auto-login error:', error);
      setAutoLoginError('Auto-login error. Please login manually.');
      setLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    setIsAuthenticated(true);
    await fetchFeed();
  };

  const fetchFeed = async () => {
    setLoading(true);
    setFeedError(null);
    setCursor(null);
    setHasMore(true);
    try {
      const response = await fetch('/api/feed');
      if (response.ok) {
        const data = await response.json();
        setFeed(data.feed);
        setCursor(data.cursor);
        setHasMore(!!data.cursor);
      } else {
        setFeedError('Failed to fetch feed. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
      setFeedError('Network error while fetching feed.');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor)}`);
      if (response.ok) {
        const data = await response.json();
        setFeed(prev => [...prev, ...data.feed]);
        setCursor(data.cursor || null);
        setHasMore(!!data.cursor);
      }
    } catch (error) {
      console.error('Error loading more:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setIsAuthenticated(false);
      setFeed([]);
      setCursor(null);
      setHasMore(true);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
    <div className="app">
      <header className="app-header">
        <h1>📸 Bluesky Media Feed</h1>
        <p>Custom feed: Media only from accounts you follow</p>
        {isAuthenticated && (
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        )}
      </header>

      <main className="app-main">
        {!isAuthenticated ? (
          <>
            {loading && !autoLoginError && (
              <div className="auto-login-loading">
                <div className="spinner"></div>
                <p>Attempting to auto-login...</p>
              </div>
            )}
            {autoLoginError && <LoginForm onLoginSuccess={handleLoginSuccess} error={autoLoginError} />}
          </>
        ) : (
          <>
            <div className="feed-controls">
              <button onClick={fetchFeed} disabled={loading} className="refresh-btn">
                {loading ? 'Loading...' : 'Refresh Feed'}
              </button>
              <p className="feed-count">{feed.length} media posts found</p>
              {feedError && <p className="feed-error">{feedError}</p>}
            </div>
            <FeedDisplay
              feed={feed}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSelectPost={setSelectedPost}
            />
          </>
        )}
      </main>
    </div>

    {selectedPost && (
      <PostModal feedItem={selectedPost} onClose={() => setSelectedPost(null)} />
    )}
    </>
  );
}

export default App;
