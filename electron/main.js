const { app, BrowserWindow, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');

// Credentials live in the OS user-data dir so they survive app updates.
// On Linux: ~/.config/BlueSkyFeed/credentials.txt
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

  // Open all external links in the system browser, not inside the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:5000')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Auto-updater only runs inside a packaged AppImage
  if (app.isPackaged) {
    setupAutoUpdater(win);
  }
}

function setupAutoUpdater(win) {
  // electron-updater reads the GitHub repo from the app-update.yml bundled by
  // electron-builder (generated from the "publish" field in package.json).
  // No setFeedURL needed — the GitHub provider handles URL construction correctly.
  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('Auto-updater: checking for updates…');
  });

  autoUpdater.on('update-not-available', () => {
    console.log('Auto-updater: already on the latest version');
  });

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available`,
      detail: 'Would you like to download and install it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded',
      detail: 'The app will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
  });

  // Delay the first check so the window is fully visible before any dialog appears
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
}

app.on('window-all-closed', () => app.quit());
