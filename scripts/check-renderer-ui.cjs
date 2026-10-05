// Run with npm run check:ui. Uses Electron's actual CSS and mouse hit testing.
const assert = require("node:assert/strict");
const { join } = require("node:path");
const electron = require("electron");

if (typeof electron === "string") {
  const { spawn } = require("node:child_process");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, [__filename], { env, stdio: "inherit", windowsHide: true });
  child.on("error", (error) => { console.error(error); process.exit(1); });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  const { app, BrowserWindow } = electron;
  app.disableHardwareAcceleration();
  app.whenReady().then(async () => {
    const timeout = setTimeout(() => { console.error("UI checks timed out"); app.exit(1); }, 120000);
    const window = new BrowserWindow({
      show: false, width: 1000, height: 700,
      webPreferences: { backgroundThrottling: false }
    });
    const evaluate = (source) => window.webContents.executeJavaScript(source);
    window.webContents.debugger.attach("1.3");
    const mouse = (type, point, button = "none") => window.webContents.debugger.sendCommand(
      "Input.dispatchMouseEvent", { type, ...point, button, clickCount: button === "none" ? 0 : 1 }
    );
    try {
      await window.loadFile(join(__dirname, "../src/renderer/editor/index.html"));
      const avatarChecks = await evaluate(`(async () => {
        const results = [];
        const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="green"/><text x="12" y="24" fill="white">S</text></svg>');
        for (const original of document.querySelectorAll('.profile-avatar')) {
          const avatar = original.cloneNode(true);
          document.body.append(avatar);
          const image = avatar.querySelector('img');
          const fallback = avatar.querySelector('span');
          const visible = (element) => getComputedStyle(element).display !== 'none';
          renderAvatar(image, fallback, null);
          results.push(!visible(image) && visible(fallback) && !!fallback.querySelector('svg'));
          renderAvatar(image, fallback, { fullName: 'Sample User' });
          results.push(!visible(image) && visible(fallback) && fallback.textContent === 'SU');
          renderAvatar(image, fallback, { fullName: 'Sample User', avatarUrl: photo });
          await image.decode();
          await new Promise(resolve => setTimeout(resolve, 20));
          results.push(visible(image) && !visible(fallback) && image.clientWidth === avatar.clientWidth);
          renderAvatar(image, fallback, { fullName: 'Sample User', avatarUrl: photo });
          results.push(visible(image) && !visible(fallback)); // Cached image.
          renderAvatar(image, fallback, { fullName: 'Sample User', avatarUrl: 'data:image/png;base64,broken' });
          await new Promise(resolve => image.addEventListener('error', resolve, { once: true }));
          results.push(!visible(image) && visible(fallback) && fallback.textContent === 'SU');
          renderAvatar(image, fallback, null);
          results.push(!visible(image) && visible(fallback) && !!fallback.querySelector('svg'));
          avatar.remove();
        }
        return results;
      })()`);
      assert.equal(avatarChecks.length, 24);
      assert.ok(avatarChecks.every(Boolean), "Guest, photo, cached photo, and failed photo must show one avatar");
      console.log("All four avatar locations pass guest/photo/fallback checks.");

      const dragChecks = await evaluate(`(async () => {
        const results = [];
        let calls = 0;
        let rejectMove = false;
        const themes = [];
        window.teleprompter = {
          async setEditorTheme(theme) { themes.push(theme); },
          async moveScriptToProject(id, projectId) {
            calls++;
            if (rejectMove) throw new Error('Test move failure');
            return { ...currentScriptsState, scripts: currentScriptsState.scripts.map(script =>
              script.id === id ? { ...script, projectId } : script) };
          }
        };
        currentScriptsState = {
          projects: [{ id: 'p1', name: 'Folder one' }, { id: 'p2', name: 'Folder two' }],
          scripts: [{ id: 's1', title: 'Test script', body: 'Test', createdAt: '2026-10-05', updatedAt: '2026-10-05' }]
        };
        renderProjectList(); renderScriptsList(); renderScriptsList();
        const move = async (projectId) => {
          const source = document.querySelector('.script-list-item');
          results.push(source.draggable);
          const transfer = new DataTransfer();
          source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
          const target = projectId ? document.querySelector('[data-project-id="' + projectId + '"]') : scriptList;
          for (let i = 0; i < 3; i++) {
            target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
          }
          results.push(target.isConnected && source.isConnected && target.classList.contains('is-drop-target'));
          target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
          await new Promise(resolve => setTimeout(resolve, 0));
        };
        await move('p1');
        results.push(currentScriptsState.scripts[0].projectId === 'p1' && expandedProjectIds.has('p1'));
        await move('p2');
        results.push(currentScriptsState.scripts[0].projectId === 'p2');
        await move(undefined);
        results.push(!currentScriptsState.scripts[0].projectId && calls === 3);
        rejectMove = true;
        await move('p1');
        results.push(!currentScriptsState.scripts[0].projectId && calls === 4);
        setEditorTheme('dark'); setEditorTheme('light');
        results.push(themes.join(',') === 'dark,light');
        return results;
      })()`);
      assert.ok(dragChecks.every(Boolean), "Dragging must preserve nodes, move between folders/root once, and roll back failures");
      console.log("Folder/root drag-and-drop, stable drop targets, and failed-move rollback pass.");

      await window.loadFile(join(__dirname, "../src/renderer/overlay/index.html"));
      await evaluate(`document.querySelector('.overlay-shell').style.animation = 'none';
        document.querySelector('.overlay-shell').classList.add('is-interface-collapsed');
        window.testClicks = [];
        document.querySelectorAll('.overlay-control').forEach(button => {
          button.addEventListener('click', event => {
            event.stopImmediatePropagation(); window.testClicks.push(button.id);
          }, true);
        });`);
      const ids = ["restartButton", "slowDownButton", "playPauseButton", "speedUpButton", "closeOverlayButton"];
      for (const id of ids) {
        const points = await evaluate(`(() => {
          const rect = document.getElementById('${id}').getBoundingClientRect();
          return [2, rect.height / 2, rect.height - 2].map(offset => ({
            x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + offset)
          }));
        })()`);
        for (const point of points) {
          await mouse("mouseMoved", { x: 0, y: 0 });
          await evaluate(`new Promise(resolve => setTimeout(resolve, 30))`);
          assert.equal(await evaluate(`getComputedStyle(document.querySelector('.overlay-control-bar')).opacity`), "0");
          await mouse("mouseMoved", point);
          await evaluate(`new Promise(resolve => setTimeout(resolve, 30))`);
          const hit = await evaluate(`(() => {
            const button = document.getElementById('${id}');
            return {
              target: document.elementFromPoint(${point.x}, ${point.y})?.closest('button')?.id,
              opacity: getComputedStyle(document.querySelector('.overlay-control-bar')).opacity,
              region: getComputedStyle(document.querySelector('.overlay-shell')).webkitAppRegion
            };
          })()`);
          assert.deepEqual(hit, { target: id, opacity: '1', region: 'no-drag' }, id + " must reveal and receive the pointer across its full height");
          await mouse("mousePressed", point, "left");
          await mouse("mouseReleased", point, "left");
          await evaluate(`document.activeElement.blur()`);
        }
      }
      assert.deepEqual(await evaluate("window.testClicks"), ids.flatMap(id => [id, id, id]));
      await mouse("mouseMoved", { x: 0, y: 0 });
      await evaluate("document.getElementById('playPauseButton').focus()");
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.overlay-control-bar')).opacity`), "1");
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.overlay-drag-handle')).webkitAppRegion`), "drag");
      console.log("All five controls pass top/center/bottom hover and click checks; keyboard focus reveals controls.");
      clearTimeout(timeout);
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
}
