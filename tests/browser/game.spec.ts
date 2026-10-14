import { expect, test, type Page } from "@playwright/test";

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./?scenario=demo");
  await expect(page.locator("#app")).toHaveAttribute("data-status", "ready");
  await expect(
    page.getByRole("button", { name: "Inizia il volo" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

test("renders the valley, starts, changes camera, pauses and resumes", async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4173/"))
      requests.push(request.url());
  });
  await page.screenshot({ path: testInfo.outputPath("intro.png") });
  await page.getByRole("button", { name: "Inizia il volo" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("flight.png") });
  await page.getByRole("button", { name: "Cambia telecamera" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-camera", "fpv");
  await page.getByRole("button", { name: "Pausa", exact: true }).click();
  const time = await page.locator("#timer").textContent();
  await page.waitForTimeout(300);
  await expect(page.locator("#timer")).toHaveText(time!);
  await page.getByRole("button", { name: "Riprendi il volo" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  await page.getByRole("button", { name: "Mostra comandi" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "paused");
  await page.locator("#quality").selectOption("eco");
  await page.getByRole("button", { name: "Torna al volo" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  expect(requests).toEqual([]);
});

test("browser-native multitouch moves and climbs together, then releases on touch cancellation", async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(
    !isMobile || browserName !== "chromium",
    "Native CDP touch injection requires mobile Chromium.",
  );
  await page.getByRole("button", { name: "Inizia il volo" }).tap();
  const move = (await page.locator("#move-stick").boundingBox())!,
    look = (await page.locator("#look-stick").boundingBox())!;
  const client = await page.context().newCDPSession(page);
  const points = [
    { x: move.x + move.width / 2, y: move.y + move.height / 2, id: 1 },
    { x: look.x + look.width / 2, y: look.y + look.height / 2, id: 2 },
  ];
  const altitude = parseInt(await page.locator("#altitude").innerText());
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points,
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points.map((p) => ({ ...p, y: p.y - 40 })),
  });
  await page.waitForTimeout(1000);
  await expect(page.locator("#move-stick")).toHaveClass(/held/);
  await expect(page.locator("#look-stick")).toHaveClass(/held/);
  expect(parseInt(await page.locator("#speed").innerText())).toBeGreaterThan(
    15,
  );
  expect(parseInt(await page.locator("#altitude").innerText())).toBeGreaterThan(
    altitude,
  );
  await client.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect(page.locator("#move-stick")).not.toHaveClass(/held/);
  await expect(page.locator("#look-stick")).not.toHaveClass(/held/);
  await expect(page.locator("#speed")).toHaveText("0km/h");
});

test("keyboard flight crosses a ring, collides, and recovers without losing progress", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Physical keyboard scenario; touch is covered separately.",
  );
  await page.getByRole("button", { name: "Inizia il volo" }).click();
  await page.keyboard.down("KeyW");
  await expect(page.locator("#app")).toHaveAttribute("data-checkpoint", "1", {
    timeout: 20000,
  });
  await page.keyboard.up("KeyW");
  await page.keyboard.down("Space");
  await page.waitForTimeout(700);
  await page.keyboard.up("Space");
  await page.keyboard.down("KeyF");
  await expect(page.locator("#app")).toHaveAttribute("data-status", "crashed");
  await page.keyboard.up("KeyF");
  await page.getByRole("button", { name: "Ritorna in volo" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  await expect(page.locator("#app")).toHaveAttribute("data-checkpoint", "1");
  await expect(page.locator("#speed")).toContainText("0");
});

async function pointer(
  page: Page,
  id: string,
  type: string,
  pointerId: number,
  dx = 0,
  dy = 0,
) {
  const target = page.locator(id),
    box = (await target.boundingBox())!;
  await target.dispatchEvent(type, {
    pointerId,
    pointerType: "touch",
    isPrimary: pointerId === 1,
    bubbles: true,
    clientX: box.x + box.width / 2 + dx,
    clientY: box.y + box.height / 2 + dy,
  });
}

test("touch layout fits portrait and landscape; two sticks and cancellation release correctly", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Touch-only controls.");
  // Synthetic pointer IDs are not active browser pointers; ignore capture only in this event-level test.
  // This verifies event handling, not physical iOS multitouch hardware.
  await page.getByRole("button", { name: "Inizia il volo" }).tap();
  await expect(page.locator("#move-stick")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: innerWidth,
  }));
  expect(dimensions.sw).toBeLessThanOrEqual(dimensions.iw);
  await page.evaluate(() => {
    for (const id of [
      "move-stick",
      "look-stick",
      "brake-button",
      "boost-button",
    ])
      document.getElementById(id)!.setPointerCapture = () => {};
  });
  await pointer(page, "#move-stick", "pointerdown", 1, 0, -40);
  await pointer(page, "#look-stick", "pointerdown", 2, 0, -35);
  await page.waitForTimeout(800);
  await expect(page.locator("#speed")).not.toHaveText("0km/h");
  await pointer(page, "#move-stick", "pointercancel", 1);
  await pointer(page, "#look-stick", "pointerup", 2);
  await expect(page.locator("#move-stick")).not.toHaveClass(/held/);
  await expect(page.locator("#look-stick")).not.toHaveClass(/held/);
  await page.waitForTimeout(1800);
  await expect(page.locator("#speed")).toHaveText("0km/h");
  await page.setViewportSize({ width: 812, height: 375 });
  const move = (await page.locator("#move-stick").boundingBox())!,
    look = (await page.locator("#look-stick").boundingBox())!;
  expect(move.y + move.height).toBeLessThan(376);
  expect(look.x + look.width).toBeLessThan(813);
  expect(look.x).toBeGreaterThan(move.x + move.width);
  await page.getByRole("button", { name: "Pausa", exact: true }).tap();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "paused");
});

test("handles unavailable storage and offers recovery when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "ready");
  await page.getByRole("button", { name: "Inizia il volo" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes("webgl")) return null;
      return original.call(this, type as "2d", ...args);
    } as typeof original;
  });
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-status", "error");
  await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
});
