import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../www/", import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
http
  .createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      let target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
      const relative = path.relative(root, target);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        response.writeHead(403).end();
        return;
      }
      if ((await stat(target)).isDirectory())
        target = path.join(target, "index.html");
      const content = await readFile(target);
      response
        .writeHead(200, {
          "Content-Type":
            types[path.extname(target)] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        })
        .end(content);
    } catch {
      response
        .writeHead(404, { "Content-Type": "text/plain" })
        .end("Not found");
    }
  })
  .listen(3100, "127.0.0.1", () =>
    console.log(
      "Local iPhone frontend preview: http://127.0.0.1:3100 (Ctrl+C to stop). Native plugins require the actual iPhone app.",
    ),
  );
