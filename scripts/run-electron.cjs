const { spawn } = require("node:child_process");

let electronPath;

try {
  electronPath = require("electron");
} catch (error) {
  console.error("Electron is not installed. Run npm install before starting the app.");
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, process.argv.slice(2), {
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
