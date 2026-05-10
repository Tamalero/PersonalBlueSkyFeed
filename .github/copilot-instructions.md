# Bluesky Custom Media Feed - Copilot Instructions

## Project Overview

A full-stack web application for creating a personalized Bluesky feed filtered by:
1. Media only (images and videos)
2. Posts from followed accounts
3. Reposts of media from followed accounts

## Project Structure

```
├── backend/          - Node.js Express API server
├── frontend/         - React web application
└── README.md        - Comprehensive documentation
```

## Technology Stack

- **Backend**: Node.js, Express, @atproto/api
- **Frontend**: React 18, Vite, CSS3
- **Authentication**: Bluesky App Password

## Key Features

1. Secure Bluesky authentication
2. Feed filtering by media type
3. Follow-based content filtering
4. Responsive web UI
5. Real-time feed updates

## Setup Commands

### Install Backend Dependencies
```bash
cd backend && npm install
```

### Install Frontend Dependencies
```bash
cd frontend && npm install
```

### Run Backend (Terminal 1)
```bash
cd backend && npm start
```

### Run Frontend (Terminal 2)
```bash
cd frontend && npm run dev
```

## API Documentation

- `POST /api/login` - User authentication
- `GET /api/feed` - Fetch filtered feed
- `POST /api/logout` - End session
- `GET /api/health` - Health check

## Development Notes

- Backend runs on port 5000
- Frontend runs on port 3000 with proxy to backend
- Frontend uses Vite for fast HMR
- Backend uses Express for API routes
- All authentication uses official Bluesky AT Protocol

## Security Considerations

- Users must use app passwords (not main password)
- Backend handles credential security
- CORS enabled for local development
- Session stored in memory (stateless in production)

## Future Enhancements

- Database integration
- User preferences storage
- Advanced filtering options
- Dark mode support
- Export capabilities
- Caching layer
