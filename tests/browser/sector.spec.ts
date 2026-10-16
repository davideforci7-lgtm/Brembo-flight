import { expect, test } from "@playwright/test";

test("real Brembilla sector starts in tranquil exploration, keeps stories optional and survives orientation changes", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const remote: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4173/")) remote.push(r.url());
  });
  await page.goto("./");
  await expect(page.locator("#start-button")).toBeVisible({ timeout: 45000 });
  await expect(page.locator("#app")).toHaveAttribute("data-dbgt-status", "ready");
  await expect(page.locator("#app")).toHaveAttribute("data-dbgt-heights", "36");
  await expect(page.locator("#flight-profile")).toHaveValue("tranquil");
  await expect(page.locator("#activity")).toHaveValue("explore");
  await page.locator("#start-button").click();
  await expect(page.locator("#app")).toHaveAttribute(
    "data-scenario",
    "brembilla",
  );
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  await expect(page.locator("#boost-button")).toBeHidden();
  await expect(page.locator("#poi-button")).toContainText("San Giovanni");
  await expect(page.locator("#modal-layer")).toBeEmpty();
  await page.locator("#poi-button").click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "paused");
  await expect(page.locator("#modal-layer")).toContainText("1896");
  await page.locator("#close-poi").click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  for (const [width, height] of [
    [375, 629],
    [812, 375],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator("#pause-button").click();
    await page.locator("#home-button").click();
    for (const id of ["flight-profile", "activity", "start-button"]) {
      const el = page.locator(`#${id}`);
      await el.scrollIntoViewIfNeeded();
      const b = (await el.boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
    }
    const a = (await page.locator("#flight-profile").boundingBox())!,
      b = (await page.locator("#activity").boundingBox())!;
    expect(a.y + a.height).toBeLessThanOrEqual(b.y);
    await page.locator("#start-button").click();
    await page.screenshot({ path: info.outputPath(`brembilla-${width}.png`) });
  }
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});

test("two thumbs keep forward, steering and latched BOOST together; cancel, brake and blur reset it", async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(
    !isMobile || browserName !== "chromium",
    "Native multitouch requires Chromium mobile emulation",
  );
  test.setTimeout(60000);
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto("./?scenario=demo");
  await page.locator("#start-button").tap();
  const left = (await page.locator("#move-stick").boundingBox())!,
    right = (await page.locator("#look-stick").boundingBox())!,
    boost = (await page.locator("#boost-button").boundingBox())!;
  expect(boost.x).toBeGreaterThan(406);
  const client = await page.context().newCDPSession(page);
  const move = {
    id: 1,
    x: left.x + left.width / 2,
    y: left.y + left.height / 2 - 38,
  };
  const boostTouch = {
    id: 2,
    x: boost.x + boost.width / 2,
    y: boost.y + boost.height / 2,
  };
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [move],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [move, boostTouch],
  });
  // CDP touchEnd lists the contacts to release, not the contacts to keep.
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [boostTouch],
  });
  await expect(page.locator("#move-stick")).toHaveClass(/held/);
  await expect(page.locator("#boost-button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      move,
      {
        id: 3,
        x: right.x + right.width / 2 + 10,
        y: right.y + right.height / 2 - 4,
      },
    ],
  });
  await expect(page.locator("#move-stick")).toHaveClass(/held/);
  await expect(page.locator("#look-stick")).toHaveClass(/held/);
  await expect
    .poll(async () => parseInt(await page.locator("#speed").innerText()))
    .toBeGreaterThan(78);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect(page.locator("#boost-button")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator("#speed")).toHaveText("0km/h");
  await page.locator("#boost-button").tap();
  await page.locator("#brake-button").tap();
  await expect(page.locator("#boost-button")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.locator("#boost-button").tap();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("#app")).toHaveAttribute("data-status", "paused");
  await expect(page.locator("#boost-button")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("a missing real terrain does not silently switch to invented geography", async ({
  page,
}) => {
  await page.route("**/geo/brembilla-centro/terrain.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("./");
  await expect(page.locator("#app")).toHaveAttribute("data-status", "error");
  await expect(page.locator("#reload-button")).toBeVisible();
  await expect(page.locator("#start-button")).toHaveCount(0);
});

test("WebGL context loss pauses and restored context offers a controlled resume", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "WEBGL_lose_context exercised in Chromium; physical Safari recovery remains a hardware check",
  );
  await page.goto("./?scenario=demo");
  await page.locator("#start-button").click();
  const supported = await page.locator("#world").evaluate((el) => {
    const gl = (el as HTMLCanvasElement).getContext("webgl2")!;
    const ext = gl.getExtension("WEBGL_lose_context");
    if (!ext) return false;
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), 700);
    return true;
  });
  expect(supported).toBe(true);
  await expect(page.locator("#modal-layer")).toContainText(
    "Ricarica il paesaggio",
  );
  await expect(page.locator("#resume-button")).toBeVisible({ timeout: 15000 });
  await page.locator("#resume-button").click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
});


test("DBGT download failure retains original heights and playable sector", async ({page}) => {
  await page.route('**/dbgt-heights.json',route=>route.fulfill({status:404,body:'missing'}));
  await page.goto('./');
  await expect(page.locator('#start-button')).toBeVisible({timeout:45000});
  await expect(page.locator('#app')).toHaveAttribute('data-dbgt-status','fallback');
  await expect(page.locator('#app')).toHaveAttribute('data-dbgt-heights','0');
  await page.locator('#start-button').click();
  await expect(page.locator('#app')).toHaveAttribute('data-status','flying');
});
