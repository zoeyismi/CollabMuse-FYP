import http from "node:http";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";

const root = process.cwd();
const files = [
  ["Homepage sections", "design-preview-home-sections.svg"],
  ["Homepage make your music", "design-preview-home-make-your-music.svg"],
  ["Dashboard", "design-preview-dashboard.svg"],
  ["Room", "design-preview-room.svg"],
];

function page() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>CollabMuse Preview</title>
  <style>
    body{margin:0;background:#020707;color:white;font-family:Inter,Arial,sans-serif}
    header{position:sticky;top:0;z-index:5;background:rgba(2,7,7,.82);backdrop-filter:blur(18px);border-bottom:1px solid rgba(220,239,244,.14);padding:18px 28px;display:flex;justify-content:space-between;align-items:center}
    h1{font-size:22px;margin:0}.tabs{display:flex;gap:10px;flex-wrap:wrap}.tabs a{color:#102027;background:#fff;border-radius:999px;padding:10px 14px;text-decoration:none;font-weight:800;font-size:13px}
    section{padding:34px 28px 70px;border-bottom:1px solid rgba(220,239,244,.12)}
    h2{font-size:28px;margin:0 0 18px}
    img{width:100%;max-width:1536px;display:block;border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.38);border:1px solid rgba(220,239,244,.16);background:#020707}
  </style>
</head>
<body>
  <header><h1>CollabMuse Website Previews</h1><nav class="tabs">${files.map(([name, file]) => `<a href="#${file}">${name}</a>`).join("")}</nav></header>
  ${files.map(([name, file]) => `<section id="${file}"><h2>${name}</h2><img src="/${file}" alt="${name}" /></section>`).join("")}
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page());
    return;
  }
  const name = url.pathname.slice(1);
  if (!files.some(([, file]) => file === name)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const body = readFileSync(join(root, name));
  const type = extname(name) === ".svg" ? "image/svg+xml" : "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  res.end(body);
});

server.listen(3000, () => {
  console.log("preview gallery running at http://localhost:3000");
});
