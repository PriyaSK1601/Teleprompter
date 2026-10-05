const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

test("Windows caption controls follow the editor theme in both directions", () => {
  const palettes = [];
  class Window {
    isDestroyed() { return false; }
    loadFile() {}
    on() {}
    setTitleBarOverlay(palette) { palettes.push(palette); }
  }
  const context = vm.createContext({
    exports: {}, __dirname: join(__dirname, "../dist/main"), process: { platform: "win32" },
    require: (id) => {
      if (id === "electron") return { BrowserWindow: Window, app: { on() {} } };
      if (id === "node:path") return require(id);
      if (id === "../shared/ipc") return require("../dist/shared/ipc.js");
      if (id === "../shared/overlayCore") return require("../dist/shared/overlayCore.js");
      if (id === "./storage") return {};
      throw new Error("Unexpected import " + id);
    }
  });
  vm.runInContext(readFileSync(join(__dirname, "../dist/main/windows.js"), "utf8"), context);
  context.exports.createEditorWindow();
  context.exports.setEditorWindowTheme("dark");
  context.exports.setEditorWindowTheme("light");
  assert.deepEqual(JSON.parse(JSON.stringify(palettes)), [
    { color: "#10120f", symbolColor: "#f3f5ef", height: 36 },
    { color: "#f5f4ed", symbolColor: "#283029", height: 36 }
  ]);
});
