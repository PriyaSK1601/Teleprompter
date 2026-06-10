import type { TeleprompterApi } from "../shared/ipc";

declare global {
  interface Window {
    teleprompter: TeleprompterApi;
  }
}

export {};

