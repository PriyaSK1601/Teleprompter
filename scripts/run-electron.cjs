const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");

let electronPath;

try {
  electronPath = require("electron");
} catch (error) {
  console.error("Electron is not installed. Run npm install before starting the app.");
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronArgs = process.argv.slice(2);
const hasUserDataArg = electronArgs.some((arg) => arg === "--user-data-dir" || arg.startsWith("--user-data-dir="));
const appArgIndex = electronArgs.findIndex((arg) => !arg.startsWith("-"));

if (appArgIndex >= 0 && !env.TELEPROMPTER_USER_DATA_DIR) {
  const appPath = resolve(process.cwd(), electronArgs[appArgIndex]);
  const profileId = createHash("sha256").update(appPath.toLowerCase()).digest("hex").slice(0, 10);
  env.TELEPROMPTER_USER_DATA_DIR = join(tmpdir(), "teleprompter-dev", profileId);
}

if (env.TELEPROMPTER_USER_DATA_DIR) {
  mkdirSync(env.TELEPROMPTER_USER_DATA_DIR, { recursive: true });

  if (!hasUserDataArg && appArgIndex >= 0) {
    electronArgs.splice(appArgIndex, 0, `--user-data-dir=${env.TELEPROMPTER_USER_DATA_DIR}`);
  }
}

const child = spawn(electronPath, electronArgs, {
  env,
  stdio: "inherit",
  windowsHide: false
});

child.on("close", (code, signal) => {
  if (signal) {
    console.error(`${electronPath} exited with signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}
