import { app, session } from "electron";
import { registerIpcHandlers } from "./ipc";
import { logError, logInfo } from "./logger";
import { registerGlobalShortcuts } from "./shortcuts";
import { ensureAppDataDirectories } from "./storage";
import { sendTeleprompterCommand } from "./windows";
import { createEditorWindow } from "./windows";

const remoteDebuggingPort = process.env.TELEPROMPTER_REMOTE_DEBUGGING_PORT;

if (remoteDebuggingPort) {
  app.commandLine.appendSwitch("remote-debugging-port", remoteDebuggingPort);
}

const userDataPath = process.env.TELEPROMPTER_USER_DATA_DIR;

if (userDataPath) {
  app.setPath("userData", userDataPath);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

app.whenReady().then(() => {
  ensureAppDataDirectories();
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });
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
