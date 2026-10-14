import { afterEach, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlaytestServer } from "../scripts/playtest.mjs";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
it("protects build files, rejects wrong codes and traversal, and serves authenticated assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "brembo-server-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "secret.txt"), "outside");
  await writeFile(join(root, "dist/index.html"), "<h1>flight</h1>");
  await writeFile(join(root, "dist/game.js"), "const game = true;");
  await writeFile(join(root, "dist/private.key"), "fixture-not-a-real-key");
  await symlink(join(root, "secret.txt"), join(root, "dist/escape.txt"));
  const { server } = await createPlaytestServer({
    root: join(root, "dist"),
    code: "test-code",
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((e: Error) => (e ? reject(e) : resolve())),
      ),
  );
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  expect(await (await fetch(base)).text()).toContain("Codice mostrato");
  expect((await fetch(`${base}/Brembo-flight/game.js`)).status).toBe(401);
  expect(
    (await fetch(`${base}/unlock`, { method: "POST", body: "code=wrong" }))
      .status,
  ).toBe(403);
  const unlock = await fetch(`${base}/unlock`, {
    method: "POST",
    body: "code=test-code",
    redirect: "manual",
  });
  expect(unlock.status).toBe(303);
  expect(unlock.headers.get("set-cookie")).toContain(
    "HttpOnly; SameSite=Strict",
  );
  const headers = { cookie: unlock.headers.get("set-cookie")!.split(";")[0] };
  const asset = await fetch(`${base}/Brembo-flight/game.js`, { headers });
  expect(asset.status).toBe(200);
  expect(asset.headers.get("content-type")).toContain("javascript");
  expect(
    (await fetch(`${base}/Brembo-flight/private.key`, { headers })).status,
  ).toBe(404);
  expect(
    (await fetch(`${base}/Brembo-flight/escape.txt`, { headers })).status,
  ).toBe(404);
  expect(
    (await fetch(`${base}/Brembo-flight/..%2fsecret.txt`, { headers })).status,
  ).toBe(404);
  expect(
    (await fetch(`${base}/Brembo-flight/game.js`, { method: "POST", headers }))
      .status,
  ).toBe(405);
});

it("supports TLS and sets a Secure session cookie", async () => {
  const { execFileSync } = await import("node:child_process");
  const { readFile } = await import("node:fs/promises");
  const https = await import("node:https");
  const root = await mkdtemp(join(tmpdir(), "brembo-tls-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "index.html"), "TLS flight");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(root, "key.pem"),
      "-out",
      join(root, "cert.pem"),
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
    ],
    { stdio: "ignore" },
  );
  const { server } = await createPlaytestServer({
    root,
    code: "tls-code",
    tls: {
      key: await readFile(join(root, "key.pem")),
      cert: await readFile(join(root, "cert.pem")),
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(
    () => new Promise<void>((resolve) => server.close(() => resolve())),
  );
  const response = await new Promise<{ status: number; cookie: string }>(
    (resolve, reject) => {
      // Only this self-signed test fixture bypasses trust; production users need a trusted certificate.
      const req = https.request(
        {
          host: "127.0.0.1",
          port: (server.address() as { port: number }).port,
          path: "/unlock",
          method: "POST",
          rejectUnauthorized: false,
        },
        (res) => {
          res.resume();
          res.on("end", () =>
            resolve({
              status: res.statusCode!,
              cookie: res.headers["set-cookie"]?.[0] ?? "",
            }),
          );
        },
      );
      req.on("error", reject);
      req.end("code=tls-code");
    },
  );
  expect(response.status).toBe(303);
  expect(response.cookie).toContain("; Secure");
});
