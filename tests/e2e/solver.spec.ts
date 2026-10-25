import { expect, test } from "@playwright/test";

test("draws the line and recommends a guess", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Random Game" })).toBeVisible();
  await expect(page.locator("#answer")).toContainText("Guess");

  await page.getByLabel("Someone guessed").fill("30");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByLabel("Someone guessed").fill("80");
  await page.getByLabel("Someone guessed").press("Enter");
  await expect(page.locator("#list li")).toHaveCount(2);

  const svg = page.locator("svg.line-svg");
  await expect(svg).toHaveAttribute("aria-label", /recommended guess 25 with a 27% chance/);
  await expect(page.locator("#answer")).toContainText("25");
  await expect(page.locator("#odds")).toContainText("27% chance to win after 1 more player");
  await page.screenshot({ path: testInfo.outputPath("line.png"), fullPage: true });

  await page.getByRole("button", { name: "Fewer players after me" }).click();
  await expect(page.locator("#odds")).toContainText("if nobody guesses after you");
  await page.getByRole("button", { name: "Remove 80" }).click();
  await expect(page.locator("#list li")).toHaveText(["30×"]);
  await expect(page.locator("#answer")).toContainText("31");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#list li")).toHaveCount(0);
});

test("tapping the line prefills the guess", async ({ page }) => {
  await page.goto("./");
  const box = await page.locator("#line").boundingBox();
  if (!box) throw new Error("no line");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const value = await page.getByLabel("Someone guessed").inputValue();
  expect(Number(value)).toBeGreaterThan(40);
  expect(Number(value)).toBeLessThan(62);
});

test("dark mode renders the line", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  await page.getByLabel("Someone guessed").fill("30");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator("svg.line-svg")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dark.png"), fullPage: true });
});

test("controls have touch-sized targets", async ({ page }) => {
  await page.goto("./");
  for (const name of ["Add", "Undo", "Fewer players after me", "More players after me"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});
