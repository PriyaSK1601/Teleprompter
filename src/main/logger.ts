import { app } from "electron";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type LogLevel = "info" | "warn" | "error";

function logPath(): string {
  return join(app.getPath("userData"), "logs", "app.log");
}

export function writeLog(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
  try {
    mkdirSync(join(app.getPath("userData"), "logs"), { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata
    };

    appendFileSync(logPath(), `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Logging should never prevent the app from starting.
  }
}

export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  writeLog("info", message, metadata);
}

export function logWarn(message: string, metadata?: Record<string, unknown>): void {
  writeLog("warn", message, metadata);
}

export function logError(message: string, metadata?: Record<string, unknown>): void {
  writeLog("error", message, metadata);
}

