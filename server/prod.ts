import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { handleVotesRequest } from "./plugin.ts";

const distDir = resolve(process.cwd(), "dist");
const port = Number(process.env.PORT ?? 4173);

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  if (await handleVotesRequest(req, res)) {
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const filePath = resolve(distDir, `.${pathname}`);
  if (!filePath.startsWith(distDir)) {
    res.statusCode = 403;
    res.end();
    return;
  }

  try {
    const data = await readFile(filePath);
    res.setHeader(
      "Content-Type",
      mimeTypes[extname(filePath)] ?? "application/octet-stream",
    );
    res.end(data);
  } catch {
    try {
      const data = await readFile(join(distDir, "index.html"));
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${port}/`);
});
