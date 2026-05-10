import { useState, useEffect } from 'react';
import './LoginForm.css';

function LoginForm({ onLoginSuccess, error: initialError }) {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');

  useEffect(() => {
    setError(initialError || '');
  }, [initialError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ handle, password }),
      });

      if (response.ok) {
        setHandle('');
        setPassword('');
        onLoginSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Login to Bluesky</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="handle">Handle or Email:</label>
            <input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="your.handle or email@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">App Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="App password (not your main password)"
              required
              disabled={loading}
            />
            <small>
              Create an app password in{' '}
              <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer">
                Bluesky Settings
              </a>
            </small>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="info-box">
          <h3>ℹ️ Privacy & Security</h3>
          <ul>
            <li>Your credentials are sent only to the backend API</li>
            <li>This app uses official Bluesky API (@atproto)</li>
            <li>Always use an app password, not your main password</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
