const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

const source = readFileSync(join(__dirname, "../dist/preload/data.js"), "utf8");

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

function createQuery(tables, tableName) {
  let operation = "select";
  let payload;
  const filters = [];

  const filteredRows = () => tables[tableName].filter((row) => filters.every((filter) => filter(row)));
  const execute = () => {
    if (operation === "insert") {
      const rows = (Array.isArray(payload) ? payload : [payload]).map((row) => ({ ...row }));
      tables[tableName].push(...rows);
      return { data: rows, error: null };
    }
    if (operation === "update") {
      const rows = filteredRows();
      for (const row of rows) Object.assign(row, payload);
      return { data: rows.map((row) => ({ ...row })), error: null };
    }
    if (operation === "delete") {
      const rows = filteredRows();
      const deleted = new Set(rows);
      tables[tableName] = tables[tableName].filter((row) => !deleted.has(row));
      return { data: rows, error: null };
    }
    return { data: filteredRows().map((row) => ({ ...row })), error: null };
  };

  const query = {
    select() { return query; },
    insert(value) { operation = "insert"; payload = value; return query; },
    update(value) { operation = "update"; payload = value; return query; },
    delete() { operation = "delete"; return query; },
    eq(column, value) { filters.push((row) => row[column] === value); return query; },
    in(column, values) { filters.push((row) => values.includes(row[column])); return query; },
    async maybeSingle() {
      const result = execute();
      return { data: result.data[0] ?? null, error: result.error };
    },
    async single() {
      const result = execute();
      return result.data[0]
        ? { data: result.data[0], error: null }
        : { data: null, error: { message: "No row returned" } };
    },
    then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); }
  };
  return query;
}

function launch() {
  let currentUserId = "user-a";
  let rpcError = null;
  const guestState = {
    scripts: [{ id: "guest-script", title: "Guest", body: "Local", createdAt: "now", updatedAt: "now" }],
    projects: []
  };
  const tables = { scripts: [], projects: [] };
  const publishedStates = [];
  const completedMigrations = [];
  const migrationLedger = new Set();
  const guestMigrationPayload = {
    migrationId: "00000000-0000-4000-8000-000000000001",
    projects: [],
    scripts: []
  };
  const client = {
    auth: {
      async getSession() {
        return { data: { session: currentUserId ? { user: { id: currentUserId } } : null }, error: null };
      },
      async getUser() {
        return { data: { user: currentUserId ? { id: currentUserId } : null }, error: null };
      }
    },
    from(tableName) {
      return createQuery(tables, tableName);
    },
    async rpc(name, input) {
      assert.equal(name, "migrate_guest_data");
      if (rpcError) return { data: null, error: { message: rpcError } };
      if (migrationLedger.has(input.p_migration_id)) return { data: false, error: null };
      migrationLedger.add(input.p_migration_id);
      tables.projects.push(...input.p_projects.map((project) => ({ ...project, user_id: currentUserId })));
      tables.scripts.push(...input.p_scripts.map((script) => ({ ...script, user_id: currentUserId })));
      return { data: true, error: null };
    }
  };
  const ipcRenderer = {
    async invoke(channel, value) {
      if (channel === "scripts:setCloudState") publishedStates.push(value);
      if (channel === "scripts:getState") return guestState;
      if (channel === "guestMigration:getPayload") return guestMigrationPayload;
      if (channel === "guestMigration:complete") completedMigrations.push(value);
      return undefined;
    }
  };
  const context = vm.createContext({
    exports: {},
    console,
    window: { sessionStorage: storage() },
    require: (id) => {
      if (id === "electron") return { ipcRenderer };
      if (id === "node:crypto") return require("node:crypto");
      if (id === "../shared/ipc") return require("../dist/shared/ipc.js");
      if (id === "./auth") return { getSupabaseClient: () => client };
      throw new Error(`Unexpected import ${id}`);
    }
  });
  vm.runInContext(source, context);
  return {
    api: context.exports.ownerAwareScriptsApi,
    tables,
    completedMigrations,
    guestMigrationPayload,
    publishedStates,
    setRpcError: (message) => { rpcError = message; },
    setUser: (userId) => { currentUserId = userId; }
  };
}

test("authenticated and Guest scripts/projects remain isolated while switching owners", async () => {
  const app = launch();

  let state = await app.api.createProject("User A project");
  const userAProject = state.projects[0];
  state = await app.api.saveScript({ title: "User A script", body: "A", projectId: userAProject.id });
  assert.equal(state.scripts.length, 1);
  assert.equal(app.tables.projects[0].user_id, "user-a");
  assert.equal(app.tables.scripts[0].user_id, "user-a");

  app.setUser("user-b");
  state = await app.api.getScriptsState();
  assert.deepEqual(JSON.parse(JSON.stringify(state)), { scripts: [], projects: [], ownerId: "user-b" });
  await app.api.saveScript({ title: "User B script", body: "B" });

  app.setUser(undefined);
  state = await app.api.getScriptsState();
  assert.equal(state.scripts[0].id, "guest-script");
  assert.equal(state.scripts.some((script) => script.title === "User A script"), false);

  app.setUser("user-a");
  state = await app.api.getScriptsState();
  assert.deepEqual(state.projects.map((project) => project.name), ["User A project"]);
  assert.deepEqual(state.scripts.map((script) => script.title), ["User A script"]);
});

test("a user cannot mutate another user's records by id", async () => {
  const app = launch();
  await app.api.saveScript({ title: "Owned by A", body: "A" });
  const userAScriptId = app.tables.scripts[0].id;

  app.setUser("user-b");
  await app.api.renameScript(userAScriptId, "Changed by B");
  await app.api.deleteScript(userAScriptId);

  assert.equal(app.tables.scripts[0].title, "Owned by A");
  assert.equal(app.tables.scripts[0].user_id, "user-a");
});

test("Guest migration preserves project relationships and is idempotent", async () => {
  const app = launch();
  const projectId = "10000000-0000-4000-8000-000000000001";
  const scriptId = "20000000-0000-4000-8000-000000000001";
  app.guestMigrationPayload.projects.push({
    id: projectId,
    name: "Guest Project",
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: "2026-10-05T00:00:00.000Z"
  });
  app.guestMigrationPayload.scripts.push({
    id: scriptId,
    title: "Guest Script",
    body: "Body",
    projectId,
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: "2026-10-05T00:00:00.000Z"
  });

  assert.equal((await app.api.migrateGuestDataToCurrentUser()).ok, true);
  assert.equal(app.tables.projects[0].user_id, "user-a");
  assert.equal(app.tables.scripts[0].user_id, "user-a");
  assert.equal(app.tables.scripts[0].project_id, projectId);
  assert.deepEqual(app.completedMigrations, [app.guestMigrationPayload.migrationId]);

  assert.equal((await app.api.migrateGuestDataToCurrentUser()).ok, true);
  assert.equal(app.tables.projects.length, 1);
  assert.equal(app.tables.scripts.length, 1);
});

test("failed Guest migration never cleans up recoverable local data", async () => {
  const app = launch();
  app.guestMigrationPayload.scripts.push({
    id: "20000000-0000-4000-8000-000000000002",
    title: "Still local",
    body: "Body",
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: "2026-10-05T00:00:00.000Z"
  });
  app.setRpcError("Database unavailable");

  const result = await app.api.migrateGuestDataToCurrentUser();

  assert.equal(result.ok, false);
  assert.match(result.message, /Database unavailable/);
  assert.deepEqual(app.completedMigrations, []);
  assert.equal(app.guestMigrationPayload.scripts.length, 1);
});
