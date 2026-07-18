import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rootPath = join(__dirname, "..", "..");

function parseEnvLine(line: string): [string, string] | null {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith("#")) {
    return null;
  }

  const equalsIndex = trimmedLine.indexOf("=");

  if (equalsIndex <= 0) {
    return null;
  }

  const key = trimmedLine.slice(0, equalsIndex).trim();
  let value = trimmedLine.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function loadLocalEnv(): void {
  for (const filename of [".env.local", ".env"]) {
    const path = join(rootPath, filename);

    if (!existsSync(path)) {
      continue;
    }

    const contents = readFileSync(path, "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);

      if (!parsed) {
        continue;
      }

      const [key, value] = parsed;

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

