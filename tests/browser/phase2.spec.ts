import { expect, test, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.goto("./");
  await expect(page.locator("#start-button")).toBeVisible();
}
async function range(page: Page, id: string, value: string) {
  await page.locator(id).evaluate((el, v) => {
    (el as HTMLInputElement).value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function bounds(page: Page, selector: string) {
  const b = (await page.locator(selector).boundingBox())!,
    v = page.viewportSize()!;
  expect(b, selector).toBeTruthy();
  expect(b.x, selector).toBeGreaterThanOrEqual(-1);
  expect(b.y, selector).toBeGreaterThanOrEqual(-1);
  expect(b.x + b.width, selector).toBeLessThanOrEqual(v.width + 1);
  expect(b.y + b.height, selector).toBeLessThanOrEqual(v.height + 1);
  return b;
}
test("responsive menus, sticks, safe areas and pixel budgets across phone, tablet and desktop sizes", async ({
  page,
  isMobile,
}, info) => {
  test.setTimeout(180000);
  const sizes = isMobile
    ? [
        [320, 568],
        [375, 629],
        [360, 640],
        [667, 375],
        [812, 375],
        [768, 1024],
        [1024, 768],
      ]
    : [
        [1280, 720],
        [1920, 1080],
        [3840, 2160],
      ];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await open(page);
    await page.locator("#start-button").scrollIntoViewIfNeeded();
    await bounds(page, "#start-button");
    await page.locator("#start-button").click();
    if (isMobile) {
      // Simulated notch/navigation insets, not a physical safe-area measurement.
      await page.locator("#app").evaluate((el) => {
        const s = (el as HTMLElement).style;
        s.setProperty("--safe-left", "24px");
        s.setProperty("--safe-right", "24px");
        s.setProperty("--safe-bottom", "20px");
      });
      const left = await bounds(page, "#move-stick"),
        right = await bounds(page, "#look-stick");
      expect(left.x + left.width + 12).toBeLessThanOrEqual(right.x);
      await bounds(page, "#boost-button");
      await bounds(page, "#brake-button");
      const boost = (await page.locator("#boost-button").boundingBox())!;
      expect(boost.x + boost.width).toBeLessThan(width * 0.43);
      const telemetry = await bounds(page, ".telemetry");
      if (width < height && width < 600) {
        expect(telemetry.y + telemetry.height).toBeLessThan(height * 0.4);
        const mission = (await page.locator(".mission").boundingBox())!;
        expect(mission.x + mission.width + 4).toBeLessThanOrEqual(telemetry.x);
      }
    }
    await bounds(page, "#pause-button");
    await page.locator("#help-button").click();
    await page.locator("#quality").selectOption("high");
    await page.locator("#showFPS").check();
    if (isMobile) {
      await range(page, "#touchSize", "1.2");
      await range(page, "#touchInset", "40");
    }
    await page.locator("#close-help").click();
    await expect(page.locator("#app")).toHaveAttribute("data-preset", "high");
    const buffer = await page
      .locator("#world")
      .evaluate((el) => ({
        w: (el as HTMLCanvasElement).width,
        h: (el as HTMLCanvasElement).height,
        cw: el.clientWidth,
        ch: el.clientHeight,
      }));
    expect(buffer.w * buffer.h).toBeLessThanOrEqual(4200000);
    expect(buffer.w / buffer.h).toBeCloseTo(width / height, 1);
    expect(buffer.cw).toBe(width);
    expect(buffer.ch).toBe(height);
    if (isMobile) {
      const left = await bounds(page, "#move-stick"),
        right = await bounds(page, "#look-stick");
      expect(left.x + left.width + 12).toBeLessThanOrEqual(right.x);
    }
    if (width === 812 || width === 375 || width === 1920)
      await page.screenshot({
        path: info.outputPath(`flight-${width}x${height}.png`),
      });
    await page.locator("#pause-button").click();
    await bounds(page, "#resume-button");
    await page.locator("#resume-button").click();
    await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  }
  expect(errors).toEqual([]);
});

test("virtual standard controller hotplug, camera, pause, disconnect and keyboard coexistence", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Controller browser integration exercised on desktop; hardware is a separate gate.",
  );
  await page.addInitScript(() => {
    const state = {
      connected: false,
      axes: [0, 0, 0, 0],
      pressed: [] as number[],
    };
    Object.assign(window, { testPad: state });
    Object.defineProperty(navigator, "getGamepads", {
      value: () =>
        state.connected
          ? [
              {
                id: "Virtual standard DualSense",
                index: 0,
                connected: true,
                mapping: "standard",
                axes: state.axes,
                buttons: Array.from({ length: 17 }, (_, i) => ({
                  pressed: state.pressed.includes(i),
                  value: state.pressed.includes(i) ? 1 : 0,
                })),
              },
            ]
          : [],
    });
  });
  const set = (data: object) =>
    page.evaluate(
      (v) =>
        Object.assign((window as unknown as { testPad: object }).testPad, v),
      data,
    );
  await open(page);
  await page.locator("#start-button").click();
  await set({ connected: true, axes: [0, -1, 0, 0] });
  await expect(page.locator("#app")).toHaveAttribute("data-status", "paused");
  await set({ axes: [0, 0, 0, 0] });
  await page.waitForTimeout(150);
  await set({ pressed: [0] });
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  await set({ pressed: [] });
  await page.waitForTimeout(150);
  await set({ axes: [0, -0.7, 0, 0] });
  await expect(page.locator("#app")).toHaveAttribute("data-input", "gamepad");
  await expect
    .poll(async () => parseInt(await page.locator("#speed").innerText()))
    .toBeGreaterThan(10);
  await page.keyboard.down("Space");
  await expect
    .poll(async () => parseInt(await page.locator("#speed").innerText()))
    .toBeLessThan(3);
  await page.keyboard.up("Space");
  await set({ axes: [0, 0, 0, 0], pressed: [3] });
  await expect(page.locator("#app")).toHaveAttribute("data-camera", "fpv");
  await page.waitForTimeout(400);
  await expect(page.locator("#app")).toHaveAttribute("data-camera", "fpv");
  await set({ pressed: [9] });
  await expect(page.locator("#app")).toHaveAttribute("data-status", "paused");
  await page.waitForTimeout(400);
  await expect(page.locator("#app")).toHaveAttribute("data-status", "paused");
  await set({ pressed: [] });
  await page.waitForTimeout(150);
  await set({ pressed: [9] });
  await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
  await set({ pressed: [], connected: false });
  await expect(page.locator("#app")).toHaveAttribute("data-status", "paused");
  await page.locator("#resume-button").click();
  await page.keyboard.down("KeyR");
  await expect
    .poll(async () => parseInt(await page.locator("#altitude").innerText()))
    .toBeGreaterThan(12);
  await page.keyboard.up("KeyR");
});

test("exploration, persisted settings, audio gesture and test report download", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Audio = window.AudioContext;
    let count = 0;
    Object.defineProperty(window, "audioContextsForTest", { get: () => count });
    window.AudioContext = class extends Audio {
      constructor(options?: AudioContextOptions) {
        super(options);
        count++;
      }
    };
  });
  await open(page);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { audioContextsForTest: number })
          .audioContextsForTest,
    ),
  ).toBe(0);
  await page.locator("#activity").selectOption("explore");
  await page.locator("#start-button").click();
  await expect(page.locator("#timer")).toHaveText("ESPLORA");
  await page.locator("#help-button").click();
  await page.locator("#audio-toggle").click();
  await expect(page.locator("#audio-toggle")).toHaveText("Silenzia tutto");
  await page.locator("#audio-toggle").click();
  await expect(page.locator("#audio-toggle")).toHaveText("Attiva audio");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { audioContextsForTest: number })
          .audioContextsForTest,
    ),
  ).toBe(1);
  await page.locator("#quality").selectOption("balanced");
  await range(page, "#sensitivity", "0.75");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-test").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("brembo-flight-prova.json");
  await page.reload();
  await page.locator("#intro-help").click();
  await expect(page.locator("#quality")).toHaveValue("balanced");
  await expect(page.locator("#sensitivity")).toHaveValue("0.75");
});
