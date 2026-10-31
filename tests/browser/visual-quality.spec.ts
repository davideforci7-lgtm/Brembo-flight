import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function graphics(page: Page) {
  const event = page.waitForEvent("download");
  await page.locator("#export-test").click();
  const download = await event;
  return JSON.parse(await readFile((await download.path())!, "utf8")).graphics;
}

test("cartographic LOD switches within budget and releases high detail on Eco", async ({ page, browserName }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
  await page.goto("./");
  await page.locator("#start-button").click();
  await page.locator("#help-button").click();
  for (const [preset, resolution, shadows] of [["high",2048,2048],["eco",1024,0]] as const) {
    await page.locator("#quality").selectOption(preset);
    await expect.poll(async () => (await graphics(page)).landcover.resolution).toBe(resolution);
    const result = await graphics(page);
    expect(result.landcover.status).toBe("ready");
    expect(result.landcover.estimatedTextureBytes).toBeLessThanOrEqual(Math.ceil(resolution ** 2 * 16 / 3));
    expect(result.landcover.detailTextureBytes).toBe(87382);
    expect(result.shadowMapSize).toBe(shadows);
  }
  await page.locator("#close-help").click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  if (browserName === "chromium") {
    await page.locator("#world").evaluate(canvas => {
      const gl = (canvas as HTMLCanvasElement).getContext("webgl2")!;
      const ext = gl.getExtension("WEBGL_lose_context")!;
      ext.loseContext();
      setTimeout(() => ext.restoreContext(), 700);
    });
    await expect(page.locator("#resume-button")).toBeVisible({timeout:15000});
    await page.locator("#resume-button").click();
    await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
    await page.locator("#help-button").click();
    expect((await graphics(page)).landcover.status).toBe("ready");
    await page.locator("#close-help").click();
  }
  expect(errors).toEqual([]);
});

test("missing cartographic map keeps terrain, flight and original colours available", async ({ page }) => {
  await page.route("**/landcover-*.png", route => route.fulfill({ status:404, body:"fixture: unavailable" }));
  await page.goto("./");
  await page.locator("#start-button").click();
  await page.locator("#help-button").click();
  await expect.poll(async () => (await graphics(page)).landcover.status).toBe("fallback");
  expect((await graphics(page)).landcover.estimatedTextureBytes).toBe(0);
  await page.locator("#close-help").click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
});
