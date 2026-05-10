# Bluesky Custom Media Feed

A web application that creates a personalized Bluesky feed showing only media (images and videos) from accounts you follow or watch, including reposts of media from those accounts.

## Features

- 🔐 Secure login with Bluesky App Passwords
- 📸 Filters feed to show only posts with images
- 🎥 Detects and displays videos
- 👥 Shows posts only from accounts you follow
- 🔄 Includes reposts of media from followed accounts
- 🎨 Beautiful, responsive web interface
- 🔗 Direct links to posts on Bluesky

## Project Structure

```
BlueSkyFeed/
├── backend/              # Node.js Express API
│   ├── server.js        # Main server and feed logic
│   ├── package.json     # Backend dependencies
│   └── .env.example     # Environment variables template
├── frontend/             # React + Vite web application
│   ├── main.jsx         # React entry point
│   ├── App.jsx          # Main app component
│   ├── index.html       # HTML entry point
│   ├── vite.config.js   # Vite build configuration
│   ├── package.json     # Frontend dependencies
│   ├── components/      # React components
│   │   ├── LoginForm.jsx
│   │   ├── FeedDisplay.jsx
│   │   └── PostCard.jsx
│   └── styles/          # CSS files
├── README.md            # This file
└── .gitignore          # Git ignore rules
```

## Prerequisites

- Node.js 16+
- npm or yarn
- A Bluesky account
- An app password from Bluesky (NOT your main password)

## Setup Instructions

### 1. Create an App Password

1. Go to [Bluesky Settings](https://bsky.app/settings/app-passwords)
2. Click "Add App Password"
3. Give it a name like "Bluesky Feed"
4. Copy the generated password (you'll need it for login)

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Configure Backend

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `.env` if needed (defaults work for most users):

```
PORT=5000
BLUESKY_SERVICE_URL=https://bsky.social
```

### 4. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

## Running the Application

### Start the Backend Server

```bash
cd backend
npm start
```

The backend will run on `http://localhost:5000`

### Start the Frontend Development Server

In a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

### Access the Application

Open your browser and go to `http://localhost:3000`

## How to Use

1. **Login**: Enter your Bluesky handle or email and app password
2. **View Feed**: Your custom media feed will load automatically
3. **Refresh**: Click "Refresh Feed" to get the latest posts
4. **View on Bluesky**: Click "View on Bluesky" to see posts in their original context
5. **Logout**: Click the logout button when done

## Feed Filtering Logic

The application filters your timeline by:

1. **Media Only**: Only shows posts with images, videos, or external media
2. **Followed Accounts**: Only displays posts from accounts you follow
3. **Includes Reposts**: Shows reposts/reblogs of media from followed accounts

## API Endpoints

### POST `/api/login`

Authenticate with Bluesky

**Request:**
```json
{
  "handle": "your.handle",
  "password": "app-password-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged in successfully"
}
```

### GET `/api/feed`

Fetch the filtered custom feed (requires authentication)

**Response:**
```json
{
  "feed": [
    {
      "post": { /* post object */ },
      "reason": null  /* or repost reason */
    }
  ]
}
```

### POST `/api/logout`

Logout from the current session

### GET `/api/health`

Health check endpoint

## Security Notes

- ✅ Uses official Bluesky AT Protocol API
- ✅ App password is only sent to your backend
- ✅ HTTPS recommended for production
- ✅ Never use your main Bluesky password
- ⚠️ Backend stores session in memory (restart clears sessions)

## Building for Production

### Backend

```bash
cd backend
NODE_ENV=production npm start
```

### Frontend

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

## Environment Variables

### Backend

- `PORT` - Server port (default: 5000)
- `BLUESKY_SERVICE_URL` - Bluesky API endpoint (default: https://bsky.social)

## Troubleshooting

### Login fails with "Invalid handle or password"

- Verify you're using an **app password**, not your main password
- Check your handle/email is correct
- Ensure the app password hasn't been revoked

### No posts showing in feed

- Make sure you follow accounts with media posts
- Try refreshing the feed
- Check the browser console for errors

### Backend not connecting

- Ensure backend is running on `http://localhost:5000`
- Check that port 5000 is not in use
- Verify CORS is enabled

### Frontend not loading

- Check that frontend dev server is running on `http://localhost:3000`
- Verify port 3000 is available
- Clear browser cache and reload

## Future Improvements

- [ ] Add filtering options (date range, media type)
- [ ] Implement persistent storage with database
- [ ] Add dark mode
- [ ] Export feed as RSS
- [ ] Add advanced search/filtering
- [ ] Implement caching for better performance
- [ ] Add user preferences/settings
- [ ] Create standalone desktop app

## License

MIT

## Support

For issues or feature requests, please create an issue on the GitHub repository.

## Disclaimer

This is an unofficial Bluesky client. Use at your own discretion and respect Bluesky's terms of service.
