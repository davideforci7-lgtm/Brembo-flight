// SPDX-License-Identifier: AGPL-3.0-only
// Local playtest server. No dependencies, accounts, telemetry or cloud hosting.
import http from "node:http";
import https from "node:https";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".json": "application/json",
};
const login = `<!doctype html><html lang="it"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brembo Flight · Prova</title><style>body{background:#123b39;color:#f4eddb;font:18px system-ui;max-width:440px;margin:10vh auto;padding:24px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;margin:12px 0;border-radius:8px}button{background:#ffc08a;border:0}small{line-height:1.5;display:block}</style><h1>BREMBO FLIGHT</h1><p>Sessione di prova</p><form method="post" action="/unlock"><label for="code">Codice mostrato sul computer che ospita la prova</label><input id="code" name="code" autocomplete="off" required maxlength="128"><button>Entra e vola</button></form><small>La sessione termina quando viene chiuso il server. Nessun dato viene inviato a servizi esterni.</small></html>`;
function same(a, b) {
  const x = Buffer.from(a || ""),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function createPlaytestServer({
  root,
  code = randomBytes(18).toString("base64url"),
  tls,
} = {}) {
  const base = await realpath(
    root ?? resolve(dirname(fileURLToPath(import.meta.url)), "../dist"),
  );
  await stat(resolve(base, "index.html"));
  const session = randomBytes(32).toString("hex");
  const handler = async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    const send = (status, content, type = "text/plain; charset=utf-8") => {
      res.writeHead(status, { "Content-Type": type });
      res.end(req.method === "HEAD" ? undefined : content);
    };
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/unlock" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 1024) {
            send(413, "Richiesta troppo grande");
            return;
          }
        }
        if (!same(new URLSearchParams(body).get("code"), code)) {
          send(403, "Codice errato. Torna indietro e riprova.");
          return;
        }
        res.setHeader(
          "Set-Cookie",
          `brembo_session=${session}; HttpOnly; SameSite=Strict; Path=/${tls ? "; Secure" : ""}`,
        );
        res.writeHead(303, { Location: "/Brembo-flight/" });
        res.end();
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        send(405, "Metodo non supportato");
        return;
      }
      const cookies = (req.headers.cookie || "")
        .split(";")
        .map((v) => v.trim());
      if (!cookies.some((v) => same(v, `brembo_session=${session}`))) {
        if (url.pathname !== "/" && url.pathname !== "/Brembo-flight/") {
          send(401, "Inserisci il codice nella pagina iniziale.");
          return;
        }
        send(200, login, "text/html; charset=utf-8");
        return;
      }
      if (url.pathname === "/") {
        res.writeHead(302, { Location: "/Brembo-flight/" });
        res.end();
        return;
      }
      if (!url.pathname.startsWith("/Brembo-flight/")) {
        send(404, "Non trovato");
        return;
      }
      const relative =
        decodeURIComponent(url.pathname.slice("/Brembo-flight/".length)) ||
        "index.html";
      const file = await realpath(resolve(base, relative));
      if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) {
        send(404, "Non trovato");
        return;
      }
      send(
        200,
        await readFile(file),
        mime[extname(file)] || "application/octet-stream",
      );
    } catch {
      send(404, "Non trovato");
    }
  };
  const server = tls
    ? https.createServer(tls, handler)
    : http.createServer(handler);
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return { server, code };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2),
      value = (name) => {
        const i = args.indexOf(name);
        return i < 0 ? undefined : args[i + 1];
      };
    const cert = value("--cert"),
      key = value("--key");
    if (!!cert !== !!key) throw new Error("Specifica sia --cert sia --key.");
    const tls = cert
      ? { cert: await readFile(cert), key: await readFile(key) }
      : undefined;
    const port = Number(value("--port") ?? 4173),
      host = value("--host") ?? "127.0.0.1";
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("Porta non valida.");
    const { server, code } = await createPlaytestServer({ tls });
    server.on("error", (error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
    server.listen(port, host, () => {
      const protocol = tls ? "https" : "http";
      console.log(
        `BREMBO FLIGHT · prova locale\n${protocol}://localhost:${port}/\nCodice: ${code}\nCtrl+C per terminare.`,
      );
      if (host === "0.0.0.0") {
        console.log(
          "Accessibile dalla rete locale con il codice. Non aprire porte sul router.",
        );
        try {
          for (const entries of Object.values(networkInterfaces()))
            for (const entry of entries || [])
              if (entry.family === "IPv4" && !entry.internal)
                console.log(`${protocol}://${entry.address}:${port}/`);
        } catch {
          console.log(
            "Apri dal telefono l’indirizzo IP locale di questo computer.",
          );
        }
      }
    });
  } catch (error) {
    console.error(
      `Avvio non riuscito: ${error.message}\nEsegui prima npm run build.`,
    );
    process.exitCode = 1;
  }
}
