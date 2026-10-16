// The only things the page can ask of the Windows app. Nothing else from Electron or Node reaches it.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("daybook", {
  // kind: "play", "pause" or "" (no timers); png: the badge as a PNG data URL.
  setTimerState: (kind, png) => ipcRenderer.send("daybook:timer-state", String(kind || ""), png || null),
  alarm: () => ipcRenderer.send("daybook:alarm")
});
