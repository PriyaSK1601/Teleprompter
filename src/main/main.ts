import { app, Menu, session } from "electron";
import { loadLocalEnv } from "./env";
import { registerIpcHandlers } from "./ipc";
import { logError, logInfo } from "./logger";
import { registerGlobalShortcuts } from "./shortcuts";
import { ensureAppDataDirectories } from "./storage";
import { forwardAuthCallbackUrl } from "./windows";
import { sendTeleprompterCommand } from "./windows";
import { createEditorWindow } from "./windows";

loadLocalEnv();

const authProtocol = "teleprompter";
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

function isAuthCallbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === `${authProtocol}:` && url.hostname === "auth" && url.pathname === "/callback";
  } catch {
    return false;
  }
}

function handlePotentialAuthCallback(argv: string[]): void {
  const callbackUrl = argv.find(isAuthCallbackUrl);

  if (callbackUrl) {
    forwardAuthCallbackUrl(callbackUrl);
  }
}

app.setAsDefaultProtocolClient(authProtocol);

app.on("open-url", (event, url) => {
  if (!isAuthCallbackUrl(url)) {
    return;
  }

  event.preventDefault();
  forwardAuthCallbackUrl(url);
});

app.on("second-instance", (_event, argv) => {
  handlePotentialAuthCallback(argv);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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
  handlePotentialAuthCallback(process.argv);

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
