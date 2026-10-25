import { expect, test } from "@playwright/test";

test("recommends a guess from the range and the guesses so far", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Random Game" })).toBeVisible();
  await expect(page.locator("#answer")).toContainText("Guess");

  await page.getByLabel("Players after me").fill("0");
  await page.getByLabel("Someone guessed").fill("30");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator("#list li")).toHaveText(["30"]);
  await expect(page.locator("#answer")).toContainText("31");
  await expect(page.locator("#odds")).toContainText("70%");
  await page.screenshot({ path: testInfo.outputPath("solver.png"), fullPage: true });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#list li")).toHaveCount(0);
});

test("add and undo have touch-sized targets", async ({ page }) => {
  await page.goto("./");
  for (const name of ["Add", "Undo"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});
