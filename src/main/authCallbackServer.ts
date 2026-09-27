import { createServer, type Server } from "node:http";
import { logError, logInfo } from "./logger";
import { forwardAuthCallbackUrl } from "./windows";

const authCallbackPort = 3000;
const authCallbackHost = "127.0.0.1";

let authCallbackServer: Server | null = null;

function isLocalAuthCallback(url: URL): boolean {
  return Boolean(
    url.searchParams.get("code") ||
    url.searchParams.get("error") ||
    url.searchParams.get("error_code") ||
    url.searchParams.get("error_description")
  );
}

function renderCallbackPage(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Teleprompter Authentication</title>
    <style>
      :root {
        color: #283029;
        background: #f5f4ed;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        align-items: center;
        display: flex;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
      }
      main {
        background: #fffefa;
        border: 1px solid rgb(40 48 41 / 0.12);
        border-radius: 28px;
        box-shadow: 0 24px 80px rgb(40 48 41 / 0.12);
        max-width: 420px;
        padding: 32px;
        text-align: center;
      }
      h1 {
        font-size: 26px;
        line-height: 1.1;
        margin: 0 0 10px;
      }
      p {
        color: rgb(40 48 41 / 0.68);
        font-size: 15px;
        line-height: 1.5;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Return to Teleprompter</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;
}

export function startAuthCallbackServer(): void {
  if (authCallbackServer) {
    return;
  }

  authCallbackServer = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://${authCallbackHost}:${authCallbackPort}`);

      if (!isLocalAuthCallback(requestUrl)) {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(renderCallbackPage("Teleprompter is ready to receive authentication links."));
        return;
      }

      forwardAuthCallbackUrl(`http://localhost:${authCallbackPort}${requestUrl.pathname}${requestUrl.search}`);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(renderCallbackPage("Authentication was sent to the Teleprompter app. You can close this browser tab."));
    } catch (error: unknown) {
      logError("Local auth callback failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      response.writeHead(500, { "content-type": "text/html; charset=utf-8" });
      response.end(renderCallbackPage("Teleprompter could not process this authentication link."));
    }
  });

  authCallbackServer.on("error", (error: NodeJS.ErrnoException) => {
    authCallbackServer = null;
    logError("Local auth callback server failed", {
      code: error.code,
      message: error.message
    });
  });

  authCallbackServer.listen(authCallbackPort, authCallbackHost, () => {
    logInfo("Local auth callback server listening", {
      url: `http://localhost:${authCallbackPort}`
    });
  });
}

export function stopAuthCallbackServer(): void {
  authCallbackServer?.close();
  authCallbackServer = null;
}
