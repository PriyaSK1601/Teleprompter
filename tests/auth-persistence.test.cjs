const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const source = readFileSync(join(__dirname, "../dist/preload/auth.js"), "utf8");

function storage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

// Restart the preload with fresh sessionStorage and the same on-disk localStorage.
// Supabase is mocked; the production storage routing and sign-in code run unchanged.
function launch(localStorage) {
  const sessionStorage = storage();
  const sessionKey = "sb-test-auth-token";
  const session = { user: { id: "test", email: "sample@example.com", user_metadata: {}, app_metadata: {} } };
  const context = vm.createContext({
    exports: {}, URL, console,
    window: { localStorage, sessionStorage },
    process: { env: { VITE_SUPABASE_URL: "https://test.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" } },
    require: (id) => {
      if (id === "electron") return { ipcRenderer: { on() {}, async invoke() {} } };
      if (id === "../shared/ipc") return require("../dist/shared/ipc.js");
      if (id === "@supabase/supabase-js") return {
        createClient: (_url, _key, { auth: { storage: authStorage } }) => ({ auth: {
          onAuthStateChange() {},
          async signInWithOAuth() {
            authStorage.setItem("sb-test-auth-token-code-verifier", "test-verifier");
            authStorage.setItem(sessionKey, JSON.stringify(session));
            return { data: { url: "https://example.com/oauth" } };
          },
          async signInWithPassword() {
            authStorage.setItem(sessionKey, JSON.stringify(session));
            return { data: { session } };
          },
          async getSession() { return { data: { session: JSON.parse(authStorage.getItem(sessionKey) ?? "null") } }; },
          async signOut() { authStorage.removeItem(sessionKey); return {}; }
        } })
      };
      throw new Error("Unexpected import " + id);
    }
  });
  vm.runInContext(source, context);
  return { api: context.exports.teleprompterAuthApi, sessionStorage };
}

test("Google sign-in persists across restart and sign-out clears saved sessions", async () => {
  const local = storage();
  const first = launch(local);
  assert.equal((await first.api.signInWithGoogle()).ok, true);
  assert.equal(first.sessionStorage.length, 0);
  const restarted = launch(local);
  assert.equal((await restarted.api.getState()).user.id, "test");
  assert.equal((await restarted.api.signOut()).ok, true);
  assert.equal((await launch(local).api.getState()).user, null);
  assert.equal(local.getItem("sb-test-auth-token-code-verifier"), null);
});

for (const remember of [false, true]) {
  test(`Password sign-in preserves remember-me=${remember}`, async () => {
    const local = storage();
    const first = launch(local);
    assert.equal((await first.api.signIn({ email: "sample@example.com", password: "test", remember })).ok, true);
    assert.equal(Boolean((await launch(local).api.getState()).user), remember);
  });
}
