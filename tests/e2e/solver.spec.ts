import { expect, test } from "@playwright/test";

test("draws the line and recommends a guess", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Random Game" })).toBeVisible();
  await expect(page.locator("#answer")).toContainText("Guess");

  await page.getByLabel("Who").fill("Ana");
  await page.getByLabel("Guessed").fill("30");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByLabel("Guessed").fill("80");
  await page.getByLabel("Guessed").press("Enter");
  await expect(page.locator("#list li")).toHaveCount(2);
  await expect(page).toHaveURL(/\?g=30%3AAna%2C80$/);

  const svg = page.locator("svg.line-svg");
  await expect(svg).toHaveAttribute("aria-label", /recommended guess \d+ with a \d+% chance/);
  await expect(page.locator("#answer")).toContainText(/Guess \d+/);
  await expect(page.locator("#odds")).toContainText(
    /\d+% expected after 1 more player, \d+% in a bad round/,
  );
  await page.screenshot({ path: testInfo.outputPath("line.png"), fullPage: true });

  await page.getByRole("button", { name: "Fewer players after me" }).click();
  await expect(page.locator("#odds")).toContainText("if nobody guesses after you");
  await page.getByRole("button", { name: "Remove 80" }).click();
  await expect(page.locator("#list li")).toHaveText(["Ana 30×"]);
  await expect(page.locator("#answer")).toContainText("31");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#list li")).toHaveCount(0);
});

test("tapping the line prefills the guess", async ({ page }) => {
  await page.goto("./");
  const box = await page.locator("#line").boundingBox();
  if (!box) throw new Error("no line");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const value = await page.getByLabel("Guessed").inputValue();
  expect(Number(value)).toBeGreaterThan(40);
  expect(Number(value)).toBeLessThan(62);
});

test("dark mode renders the line", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  await page.getByLabel("Guessed").fill("30");
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

test("reveals the winner, keeps score, and restores state from the URL", async ({
  page,
}, testInfo) => {
  await page.goto("./?lo=1&hi=50&k=2&g=10%3AAna%2C40%3ABen");
  await expect(page.locator("#hi")).toHaveValue("50");
  await expect(page.locator("#after")).toHaveValue("2");
  await expect(page.locator("#list li")).toHaveText(["Ana 10×", "Ben 40×"]);

  await page.getByLabel("The number was").fill("33");
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.locator("#result")).toHaveText("Ben wins with 40, off by 7.");
  await expect(page.locator("#answer")).toBeHidden();
  await expect(page.locator("svg.line-svg .secret-lbl")).toHaveText("33");
  await page.locator("#board summary").click();
  await expect(page.locator("#tally tbody tr")).toHaveText(["Ben11", "Ana01"]);
  await page.screenshot({ path: testInfo.outputPath("reveal.png"), fullPage: true });

  await page.getByRole("button", { name: "New round" }).click();
  await expect(page.locator("#list li")).toHaveCount(0);
  await expect(page).toHaveURL(/\?hi=50&k=2$/);
  await page.reload();
  await page.locator("#board summary").click();
  await expect(page.locator("#tally tbody tr")).toHaveCount(2);
  await page.locator("details:has(#mix) summary").click();
  await expect(page.locator("#mix")).toContainText("Learned from 2 guesses at your table");
  await page.getByRole("button", { name: "Clear scoreboard" }).click();
  await expect(page.locator("#board")).toBeHidden();
  await expect(page.locator("#mix")).toContainText("starting guess");
});
