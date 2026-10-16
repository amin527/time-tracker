// Daybook for Windows: a desktop window around timeblocks.html.
// The page keeps its data in its own localStorage (under %APPDATA%\Daybook), exactly as in a browser.
"use strict";

const { app, BrowserWindow, Menu, Notification, dialog, ipcMain, nativeImage, nativeTheme, screen, session, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const APP_ID = "com.daybook.app";
const ROOT = path.join(__dirname, "..");
const PAGE = path.join(ROOT, "timeblocks.html");
const ICON = path.join(ROOT, "build", "icon.ico");

let win = null;

// One window only: two copies of the page would each save over the other's data.
if(!app.requestSingleInstanceLock()){
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);
  app.on("second-instance", showWindow);
  app.whenReady().then(start);
  app.on("window-all-closed", () => app.quit());
}

function showWindow(){
  if(!win) return;
  if(win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ---- Window size and position, kept between runs -------------------------------------

function boundsFile(){ return path.join(app.getPath("userData"), "window-state.json"); }

function loadBounds(){
  try{
    const b = JSON.parse(fs.readFileSync(boundsFile(), "utf8"));
    if(!(b.width > 0 && b.height > 0)) return null;
    // Only reuse the position if it is still on a connected screen.
    const onScreen = typeof b.x === "number" && screen.getAllDisplays().some(({ workArea: a }) =>
      b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y);
    if(!onScreen){ delete b.x; delete b.y; }
    return b;
  }catch(e){
    return null;
  }
}

function saveBounds(){
  if(!win) return;
  try{
    fs.writeFileSync(boundsFile(), JSON.stringify(Object.assign({ maximized: win.isMaximized() }, win.getNormalBounds())));
  }catch(e){}
}

// ---- Startup ---------------------------------------------------------------------------

function start(){
  Menu.setApplicationMenu(buildMenu());

  // Export Day and Back Up All download a file: ask where to save it, starting in Documents.
  session.defaultSession.on("will-download", (ev, item) => {
    item.setSaveDialogOptions({
      title: "Save " + item.getFilename(),
      defaultPath: path.join(app.getPath("documents"), item.getFilename()),
      filters: [{ name: "Daybook file", extensions: [path.extname(item.getFilename()).slice(1) || "json"] }]
    });
  });

  // The page only ever needs notifications (for the preset timer).
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(permission === "notifications"));

  createWindow();
}

function createWindow(){
  const saved = loadBounds() || {};
  win = new BrowserWindow({
    width: saved.width || 1280,
    height: saved.height || 860,
    x: saved.x,
    y: saved.y,
    minWidth: 520,
    minHeight: 400,
    title: "Daybook",
    icon: ICON,
    show: false,
    autoHideMenuBar: true,
    // Same colour as the page, so the window does not flash white while it loads.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#17160f" : "#faf8f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Timers must keep ticking (and the preset timer must ring on time) while the window
      // is minimised or behind other windows.
      backgroundThrottling: false,
      // The alarm can ring without a click first, e.g. for a timer resumed at start-up.
      autoplayPolicy: "no-user-gesture-required"
    }
  });
  if(saved.maximized) win.maximize();

  win.once("ready-to-show", () => win.show());
  win.on("focus", () => win.flashFrame(false));
  win.on("close", saveBounds);
  win.on("closed", () => { win = null; });

  // The app never leaves its page: links to the web open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if(/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (ev, url) => {
    if(url.split("#")[0] === win.webContents.getURL().split("#")[0]) return;
    ev.preventDefault();
    if(/^https?:/i.test(url)) shell.openExternal(url);
  });

  win.loadFile(PAGE);
}

// ---- Messages from the page --------------------------------------------------------------

function fromOurWindow(ev){ return win && ev.sender === win.webContents; }

// The play / pause badge on the taskbar button, like the tab icon in a browser.
ipcMain.on("daybook:timer-state", (ev, kind, png) => {
  if(!fromOurWindow(ev)) return;
  if(!kind || typeof png !== "string" || !png.startsWith("data:image/png;base64,")){
    win.setOverlayIcon(null, "");
    return;
  }
  win.setOverlayIcon(nativeImage.createFromDataURL(png), kind === "play" ? "Timer running" : "Timer paused");
});

// The preset timer reached zero: flash the taskbar button and show a notification.
ipcMain.on("daybook:alarm", (ev) => {
  if(!fromOurWindow(ev)) return;
  if(!win.isFocused()) win.flashFrame(true);
  if(Notification.isSupported()){
    const n = new Notification({ title: "Daybook", body: "The preset timer has reached zero.", icon: ICON, silent: true });
    n.on("click", showWindow);
    n.show();
  }
});

// ---- Menu (hidden; Alt shows it) ---------------------------------------------------------

function buildMenu(){
  return Menu.buildFromTemplate([
    { label: "&File", submenu: [
      { label: "Open Data Folder", click: () => shell.openPath(app.getPath("userData")) },
      { type: "separator" },
      { role: "quit", label: "Exit" }
    ] },
    { label: "&Edit", submenu: [
      { role: "undo" }, { role: "redo" }, { type: "separator" },
      { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }
    ] },
    { label: "&View", submenu: [
      { role: "reload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" }
    ] },
    { label: "&Help", submenu: [
      { label: "About Daybook", click: () => {
        dialog.showMessageBox(win, {
          type: "info",
          title: "About Daybook",
          message: "Daybook " + app.getVersion(),
          detail: "Electron " + process.versions.electron + "\nData is kept in " + app.getPath("userData")
        });
      } }
    ] }
  ]);
}
