import { useState, useEffect } from 'react';
import './LoginForm.css';

function LoginForm({ onLoginSuccess, error: initialError }) {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [saveNotice, setSaveNotice] = useState('');

  useEffect(() => {
    setError(initialError || '');
  }, [initialError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaveNotice('');
    setLoading(true);

    try {
      const loginRes = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, password }),
      });

      if (!loginRes.ok) {
        const data = await loginRes.json();
        setError(data.error || 'Login failed');
        return;
      }

      if (saveCredentials) {
        try {
          const saveRes = await fetch('/api/save-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ handle, password }),
          });
          if (!saveRes.ok) throw new Error('save failed');
          setSaveNotice('Credentials saved — next launch will log in automatically.');
        } catch {
          setSaveNotice('Login successful, but credentials could not be saved.');
        }
      }

      setHandle('');
      setPassword('');
      // Give the user a moment to read the save notice before transitioning
      setTimeout(() => onLoginSuccess(), saveCredentials ? 1200 : 0);
    } catch {
      setError('Network error. Please try again.');
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

          <div className="form-group form-group--checkbox">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={saveCredentials}
                onChange={(e) => setSaveCredentials(e.target.checked)}
                disabled={loading}
              />
              <span>Save credentials for automatic login</span>
            </label>
            <small>
              Credentials are encrypted with AES-256-GCM using a key derived from this
              machine's identity. Stored locally — never sent anywhere.
            </small>
          </div>

          {error && <div className="error-message">{error}</div>}
          {saveNotice && <div className="save-notice">{saveNotice}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="info-box">
          <h3>ℹ️ Privacy &amp; Security</h3>
          <ul>
            <li>Your credentials are sent only to the local backend API</li>
            <li>This app uses the official Bluesky API (@atproto)</li>
            <li>Always use an app password, not your main password</li>
            <li>Saved credentials are AES-256 encrypted on disk</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
