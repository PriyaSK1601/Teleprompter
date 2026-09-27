const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error("Run this dependency check through npm run dev.");
  process.exit(1);
}

// Invoke npm through Node so this also works with npm.cmd on Windows.
const result = spawnSync(process.execPath, [npmCli, "ls", "--depth=0", "--include=dev"], {
  cwd: resolve(__dirname, ".."),
  encoding: "utf8",
  windowsHide: true
});

if (result.error) {
  console.error(`Unable to check project dependencies: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.stderr.write(result.stdout || result.stderr || "Dependency check failed.\n");
  console.error(
    "\nProject dependencies are missing or out of date.\n" +
    "Run npm install, then npm run dev again.\n" +
    "After pulling changes or switching branches, install dependencies before starting the app."
  );
  process.exit(1);
}
