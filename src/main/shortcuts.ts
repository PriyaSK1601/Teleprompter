import { app, globalShortcut } from "electron";
import type { ShortcutStatus, TeleprompterCommand } from "../shared/ipc";
import { logWarn } from "./logger";
import { defaultShortcutBindings, loadShortcutsFile, resetShortcutBindings, updateShortcutBindings } from "./storage";
import type { ShortcutBinding, ShortcutUpdateInput } from "../shared/ipc";

const shortcutStatus = new Map<TeleprompterCommand, ShortcutStatus>();
let commandHandler: ((command: TeleprompterCommand) => void) | null = null;

export function registerGlobalShortcuts(onCommand: (command: TeleprompterCommand) => void): void {
  commandHandler = onCommand;
  registerBindings(loadShortcutsFile().bindings);
}

function registerBindings(bindings: ShortcutBinding[]): ShortcutStatus[] {
  globalShortcut.unregisterAll();
  shortcutStatus.clear();

  for (const binding of bindings) {
    let registered = false;

    if (binding.enabled) {
      try {
        registered = globalShortcut.register(binding.accelerator, () => {
          commandHandler?.(binding.action);
        });
      } catch {
        registered = false;
      }
    }

    shortcutStatus.set(binding.action, {
      ...binding,
      registered
    });

    if (binding.enabled && !registered) {
      logWarn("Global shortcut registration failed", binding);
    }
  }

  return getShortcutStatus();
}

export function getShortcutStatus(): ShortcutStatus[] {
  const bindings = loadShortcutsFile().bindings;

  return bindings.map((binding) => {
    return (
      shortcutStatus.get(binding.action) ?? {
        ...binding,
        registered: false
      }
    );
  });
}

export function updateGlobalShortcuts(input: ShortcutUpdateInput): ShortcutStatus[] {
  const bindings = updateShortcutBindings(input);
  return registerBindings(bindings);
}

export function resetGlobalShortcuts(): ShortcutStatus[] {
  const bindings = resetShortcutBindings();
  return registerBindings(bindings);
}

export function getDefaultShortcutStatus(): ShortcutStatus[] {
  return defaultShortcutBindings.map((binding) => ({
    ...binding,
    registered: false
  }));
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
