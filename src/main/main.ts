import { app } from "electron";
import { registerIpcHandlers } from "./ipc";
import { logError, logInfo } from "./logger";
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
  logInfo("App starting", {
    version: app.getVersion(),
    platform: process.platform
  });
  registerIpcHandlers();
  registerGlobalShortcuts((command) => {
    sendTeleprompterCommand(command, "shortcut");
  });
  createEditorWindow();

  app.on("activate", () => {
    createEditorWindow();
  });
}).catch((error: unknown) => {
  logError("App startup failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
