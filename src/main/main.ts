import { app } from "electron";
import { registerIpcHandlers } from "./ipc";
import { registerGlobalShortcuts } from "./shortcuts";
import { ensureAppDataDirectories } from "./storage";
import { sendTeleprompterCommand } from "./windows";
import { createEditorWindow } from "./windows";

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

app.whenReady().then(() => {
  ensureAppDataDirectories();
  registerIpcHandlers();
  registerGlobalShortcuts((command) => {
    sendTeleprompterCommand(command, "shortcut");
  });
  createEditorWindow();

  app.on("activate", () => {
    createEditorWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
