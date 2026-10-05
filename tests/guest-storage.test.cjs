const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const testUserDataPath = mkdtempSync(join(tmpdir(), "teleprompter-guest-storage-"));
const electronPath = require.resolve("electron");
require.cache[electronPath] = {
  id: electronPath,
  filename: electronPath,
  loaded: true,
  exports: { app: { getPath: () => testUserDataPath } },
  children: [],
  paths: []
};

const storage = require("../dist/main/storage.js");

test.after(() => {
  rmSync(testUserDataPath, { recursive: true, force: true });
});

test("Guest migration payload is stable and cleanup only follows the matching batch", () => {
  let state = storage.createProject("Guest Project");
  const projectId = state.projects[0].id;
  state = storage.saveScript({ title: "Guest Script", body: "Body", projectId });
  const scriptId = state.scripts[0].id;

  const first = storage.getGuestMigrationPayload();
  const second = storage.getGuestMigrationPayload();

  assert.equal(first.migrationId, second.migrationId);
  assert.equal(first.projects[0].id, projectId);
  assert.equal(first.scripts[0].id, scriptId);
  assert.equal(first.scripts[0].projectId, projectId);

  assert.throws(
    () => storage.completeGuestMigration("00000000-0000-4000-8000-000000000000"),
    /workspace changed/i
  );
  assert.equal(storage.getScriptsState().scripts.length, 1);

  storage.completeGuestMigration(first.migrationId);
  assert.deepEqual(storage.getScriptsState().scripts, []);
  assert.deepEqual(storage.getScriptsState().projects, []);
  assert.notEqual(storage.getGuestMigrationPayload().migrationId, first.migrationId);
});
