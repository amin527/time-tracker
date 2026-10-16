// Builds the Windows installer and portable .exe into dist/. Run with: npm run dist
// electron-builder needs Node 20 or newer, so this runs on the Node built into Electron
// (see the "dist" script in package.json) rather than whichever Node is installed.
"use strict";

// Electron's Node opens .asar archives as if they were folders; the builder needs them as plain files.
process.noAsar = true;

const builder = require("electron-builder");

builder.build({ win: ["nsis", "portable"], publish: "never" })
  .then((files) => {
    console.log("Built:\n  " + files.join("\n  "));
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
