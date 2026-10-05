const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

const source = readFileSync(join(__dirname, "../dist/preload/auth.js"), "utf8");

function createStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

function launch(localStorage = createStorage()) {
  const sessionStorage = createStorage();
  const calls = {};
  const session = {
    user: {
      id: "test-user",
      email: "person@example.com",
      user_metadata: {},
      app_metadata: {}
    }
  };
  let authListener;

  const context = vm.createContext({
    exports: {},
    URL,
    URLSearchParams,
    console,
    window: { localStorage, sessionStorage },
    process: {
      env: {
        VITE_SUPABASE_URL: "https://test.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test"
      }
    },
    require: (id) => {
      if (id === "electron") {
        return { ipcRenderer: { on() {}, async invoke() {} } };
      }
      if (id === "../shared/ipc") {
        return require("../dist/shared/ipc.js");
      }
      if (id === "@supabase/supabase-js") {
        return {
          createClient: (_url, _key, { auth: { storage } }) => ({
            auth: {
              onAuthStateChange(callback) {
                authListener = callback;
              },
              async getSession() {
                return { data: { session: null }, error: null };
              },
              async signUp(input) {
                calls.signUp = input;
                return { data: { session: null }, error: null };
              },
              async resend(input) {
                calls.resend = input;
                return { error: calls.resendError ?? null };
              },
              async resetPasswordForEmail(email, options) {
                calls.resetPassword = { email, options };
                return { error: null };
              },
              async signInWithOAuth(input) {
                calls.oauth = input;
                storage.setItem("sb-test-auth-token", JSON.stringify(session));
                return { data: { url: "https://example.com/oauth" }, error: null };
              },
              async signOut() {
                return { error: null };
              }
            }
          })
        };
      }
      throw new Error(`Unexpected import ${id}`);
    }
  });

  vm.runInContext(source, context);
  return {
    api: context.exports.teleprompterAuthApi,
    authListener: (...args) => authListener(...args),
    calls,
    localStorage,
    sessionStorage,
    session
  };
}

test("signup and resend request confirmation mail with the app callback", async () => {
  const app = launch();
  const signup = await app.api.signUp({
    fullName: "Test Person",
    email: "  person@gmail.com  ",
    password: "long-enough-password",
    remember: true
  });

  assert.equal(signup.ok, true);
  assert.equal(signup.needsEmailConfirmation, true);
  assert.equal(signup.pendingEmail, "person@gmail.com");
  assert.equal(app.calls.signUp.email, "person@gmail.com");
  assert.equal(app.calls.signUp.options.emailRedirectTo, "teleprompter://auth/callback");

  const resend = await app.api.resendSignupConfirmation("  person@gmail.com ");
  assert.equal(resend.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls.resend)), {
    type: "signup",
    email: "person@gmail.com",
    options: { emailRedirectTo: "teleprompter://auth/callback" }
  });
});

test("password reset trims the address and returns through the app callback", async () => {
  const app = launch();
  const result = await app.api.sendPasswordReset("  person@gmail.com ");

  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls.resetPassword)), {
    email: "person@gmail.com",
    options: { redirectTo: "teleprompter://auth/callback" }
  });
});

test("unauthorized delivery explains the custom SMTP requirement", async () => {
  const app = launch();
  app.calls.resendError = {
    message: "Email address not authorized",
    error_code: "email_address_not_authorized"
  };

  const result = await app.api.resendSignupConfirmation("person@gmail.com");

  assert.equal(result.ok, false);
  assert.match(result.message, /custom SMTP/i);
});

test("password recovery auth events open the recovery flow", async () => {
  const app = launch();
  const events = [];
  app.api.onAuthEvent((event) => events.push(event));
  await app.api.getState();

  app.authListener("PASSWORD_RECOVERY", app.session);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "recovery");
  assert.equal(events[0].state.user.email, "person@example.com");
});

test("Google auth stores its session persistently", async () => {
  const app = launch();
  const result = await app.api.signInWithGoogle();

  assert.equal(result.ok, true);
  assert.equal(app.localStorage.getItem("teleprompter.auth.rememberMe"), "1");
  assert.ok(app.localStorage.getItem("sb-test-auth-token"));
  assert.equal(app.sessionStorage.getItem("sb-test-auth-token"), null);
});
