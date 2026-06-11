const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");

const rendererDist = join(__dirname, "..", "dist", "renderer");
const forbiddenPatterns = [
  {
    label: "CommonJS exports",
    pattern: /\bexports\b/
  },
  {
    label: "CommonJS require",
    pattern: /\brequire\s*\(/
  }
];

function listJavaScriptFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return listJavaScriptFiles(path);
    }

    return path.endsWith(".js") ? [path] : [];
  });
}

const failures = [];

for (const file of listJavaScriptFiles(rendererDist)) {
  const source = readFileSync(file, "utf8");

  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(source)) {
      failures.push(`${label} found in ${file}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Renderer bundles are browser-safe.");
