import { app, globalShortcut } from "electron";
import type { ShortcutStatus, TeleprompterCommand } from "../shared/ipc";
import { logWarn } from "./logger";

type ShortcutDefinition = {
  action: TeleprompterCommand;
  accelerator: string;
};

const shortcutDefinitions: ShortcutDefinition[] = [
  { action: "showOverlay", accelerator: "CommandOrControl+Alt+O" },
  { action: "hideOverlay", accelerator: "CommandOrControl+Alt+H" },
  { action: "startPause", accelerator: "CommandOrControl+Alt+Space" },
  { action: "restart", accelerator: "CommandOrControl+Alt+R" },
  { action: "speedUp", accelerator: "CommandOrControl+Alt+Up" },
  { action: "slowDown", accelerator: "CommandOrControl+Alt+Down" }
];

const shortcutStatus = new Map<TeleprompterCommand, ShortcutStatus>();

export function registerGlobalShortcuts(onCommand: (command: TeleprompterCommand) => void): void {
  for (const definition of shortcutDefinitions) {
    const registered = globalShortcut.register(definition.accelerator, () => {
      onCommand(definition.action);
    });

    shortcutStatus.set(definition.action, {
      ...definition,
      registered
    });

    if (!registered) {
      logWarn("Global shortcut registration failed", definition);
    }
  }
}

export function getShortcutStatus(): ShortcutStatus[] {
  return shortcutDefinitions.map((definition) => {
    return (
      shortcutStatus.get(definition.action) ?? {
        ...definition,
        registered: false
      }
    );
  });
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
