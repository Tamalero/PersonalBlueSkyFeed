const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

// Set credentials path to the OS user-data dir so it survives app updates.
// On Linux this is ~/.config/BlueSkyFeed/credentials.txt
app.whenReady().then(() => {
  process.env.CREDENTIALS_PATH = path.join(app.getPath('userData'), 'credentials.txt');
  process.env.NODE_ENV = 'production';

  // Run Express server in-process — no forking needed since Electron IS Node.js
  require('../backend/server.js');

  waitForServer(createWindow);
});

function waitForServer(callback) {
  http.get('http://localhost:5000/api/health', () => callback())
    .on('error', () => setTimeout(() => waitForServer(callback), 100));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Bluesky Media Feed',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadURL('http://localhost:5000');
}

app.on('window-all-closed', () => app.quit());
