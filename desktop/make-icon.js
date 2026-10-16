// Builds build/icon.ico from the page's logo. Run with: npm run icon
"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

// The logo from timeblocks.html's tab icon.
const SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>" +
  "<rect width='32' height='32' rx='7' fill='#3a5a40'/>" +
  "<rect x='7' y='7' width='18' height='4.5' rx='1.5' fill='#faf8f4'/>" +
  "<rect x='7' y='13.75' width='12' height='4.5' rx='1.5' fill='#faf8f4' opacity='.85'/>" +
  "<rect x='7' y='20.5' width='15' height='4.5' rx='1.5' fill='#faf8f4' opacity='.7'/></svg>";
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];

// An .ico file whose images are PNGs (supported since Windows Vista).
function buildIco(pngs){
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header].concat(entries, pngs.map((p) => p.data)));
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL("data:text/html,<html><body></body></html>");
  const urls = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(${JSON.stringify(SIZES)}.map((s) => {
        const c = document.createElement("canvas");
        c.width = c.height = s;
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(img, 0, 0, s, s);
        return c.toDataURL("image/png");
      }));
      img.onerror = reject;
      img.src = "data:image/svg+xml," + encodeURIComponent(${JSON.stringify(SVG)});
    })`);
  const pngs = urls.map((u, i) => ({ size: SIZES[i], data: Buffer.from(u.split(",")[1], "base64") }));
  const out = path.join(__dirname, "..", "build");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "icon.ico"), buildIco(pngs));
  fs.writeFileSync(path.join(out, "icon-256.png"), pngs[pngs.length - 1].data);
  console.log("Wrote build/icon.ico (" + SIZES.join(", ") + " px)");
  app.quit();
});
