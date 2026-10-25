import { expect, test, type Page } from "@playwright/test";

async function addGuess(page: Page, n: string, who = "") {
  if (who) await page.getByLabel("Who").fill(who);
  await page.getByLabel("Guessed", { exact: true }).fill(n);
  await page.getByRole("button", { name: "Add" }).click();
}

test("draws the line and recommends a guess", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Random Game" })).toBeVisible();
  await expect(page.locator("#answer")).toContainText("Guess");

  await addGuess(page, "30", "Ana");
  await page.getByLabel("Guessed", { exact: true }).fill("80");
  await page.getByLabel("Guessed", { exact: true }).press("Enter");
  await expect(page.locator("#list li")).toHaveCount(2);
  await expect(page).toHaveURL(/\?g=30%3AAna%2C80$/);

  const svg = page.locator("svg.line-svg");
  await expect(svg).toHaveAttribute("aria-label", /recommended guess 25 with a 25% chance/);
  await expect(page.locator("#answer")).toContainText("Guess 25");
  await expect(page.locator("#odds")).toHaveText(
    "25% expected after 1 more player, 25% in a bad round.",
  );
  await page.screenshot({ path: testInfo.outputPath("line.png"), fullPage: true });

  await page.getByRole("button", { name: "Fewer players after me" }).click();
  await expect(page.locator("#odds")).toContainText("if nobody guesses after you");
  await expect(page.getByRole("button", { name: "Fewer players after me" })).toBeDisabled();
  await page.getByRole("button", { name: "Remove 80" }).click();
  await expect(page.locator("#list li")).toHaveText(["Ana 30×"]);
  await expect(page.locator("#answer")).toContainText("31");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#list li")).toHaveCount(0);
});

test("the URL follows a range edit and guesses inside the new range survive it", async ({
  page,
}) => {
  await page.goto("./?g=30%3AAna%2C80%3ABen");
  await page.locator("#hi").fill("50");
  await expect(page).toHaveURL(/\?hi=50&g=30%3AAna%2C80%3ABen$/);
  await expect(page.locator("#list li")).toHaveCount(2);
  await page.locator("#hi").blur();
  await expect(page.locator("#list li")).toHaveText(["Ana 30×"]);
  await expect(page).toHaveURL(/\?hi=50&g=30%3AAna$/);
});

test("rejects bad input with a message instead of silence", async ({ page }) => {
  await page.goto("./");
  await addGuess(page, "500");
  await expect(page.locator("#note")).toHaveText("500 is outside 1 to 100.");
  await expect(page.getByLabel("Guessed", { exact: true })).toHaveValue("500");
  await addGuess(page, "30");
  await addGuess(page, "30", "Zoe");
  await expect(page.locator("#note")).toHaveText("30 is already taken.");
  await page.locator("#lo").fill("200");
  await expect(page.locator("#odds")).toHaveText(
    "The range needs a smaller first number and a larger second one.",
  );
  await expect(page.locator("#lo")).toHaveAttribute("aria-invalid", "true");
});

test("tapping the line prefills the guess and marks it as mine", async ({ page }) => {
  await page.goto("./");
  const box = await page.locator("#line").boundingBox();
  if (!box) throw new Error("no line");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const value = Number(await page.getByLabel("Guessed", { exact: true }).inputValue());
  expect(value).toBeGreaterThan(40);
  expect(value).toBeLessThan(62);
  const recommended = await page.getByLabel("Guessed", { exact: true }).getAttribute("placeholder");
  await page.getByLabel("Guessed", { exact: true }).fill(recommended ?? "");
  await expect(page.getByLabel("that's me")).toBeChecked();
});

test("dark mode renders the line", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  await addGuess(page, "30");
  await expect(page.locator("svg.line-svg")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dark.png"), fullPage: true });
});

test("controls have touch-sized targets", async ({ page }) => {
  await page.goto("./");
  await addGuess(page, "30");
  for (const name of [
    "Add",
    "Undo",
    "Fewer players after me",
    "More players after me",
    "Remove 30",
    "Reveal",
  ]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0, name).toBeGreaterThanOrEqual(44);
  }
});

test("reveals the winner, keeps score, learns only from others, and restores from the URL", async ({
  page,
}, testInfo) => {
  await page.goto("./?lo=1&hi=50&k=2&g=10%3AAna%2C*40%3ABen");
  await expect(page.locator("#hi")).toHaveValue("50");
  await expect(page.getByLabel("Players after me", { exact: true })).toHaveValue("2");
  await expect(page.locator("#list li")).toHaveText(["Ana 10×", "Ben 40 (me)×"]);

  await page.getByLabel("The number was").fill("33");
  await page.getByLabel("The number was").press("Enter");
  await expect(page.locator("#result")).toHaveText("Ben wins with 40, off by 7.");
  await expect(page.locator("#answer")).toBeHidden();
  await expect(page.locator("svg.line-svg .secret-lbl")).toHaveText("33");
  await expect(page.locator("svg.line-svg .big")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New round" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Add" })).toBeDisabled();
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
  await expect(page.locator("#mix")).toContainText("Learned from 1 guess at your table");
  await page.getByRole("button", { name: "Clear scoreboard and what it learned" }).click();
  await expect(page.locator("#board")).toBeHidden();
  await expect(page.locator("#mix")).toContainText("starting guess");
});

test("names a tie, refuses a secret outside the range, and says when every number is taken", async ({
  page,
}) => {
  await page.goto("./?g=30,50");
  await page.getByLabel("The number was").fill("500");
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.locator("#note")).toHaveText("500 is outside 1 to 100.");
  await expect(page.getByRole("button", { name: "Reveal" })).toBeVisible();
  await page.getByLabel("The number was").fill("40");
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.locator("#result")).toHaveText("30 and 50 tie, each off by 10.");
  await expect(page.locator("#board")).toBeHidden();

  await page.goto("./?lo=1&hi=2&g=1,2");
  await expect(page.locator("#odds")).toHaveText("Every number is taken.");
  await expect(page.locator("#answer")).toBeEmpty();
});
