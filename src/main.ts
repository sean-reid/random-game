import "./style.css";
import { MAX_AFTER, recommend, type Board } from "./engine";
import { numberAt, renderLine } from "./ui/line";

const app = document.getElementById("app") as HTMLElement;

const state: Board & { after: number } = { lo: 1, hi: 100, guesses: [], after: 1 };

app.innerHTML = `
  <h1>Random Game</h1>
  <p class="soft">Someone picked a number. Closest guess wins. Enter the range and the guesses so far, and the line shows where to go.</p>
  <div class="row">
    <label>From <input id="lo" type="number" inputmode="numeric" value="1" /></label>
    <label>To <input id="hi" type="number" inputmode="numeric" value="100" /></label>
    <label>Players after me
      <span class="stepper">
        <button id="fewer" type="button" aria-label="Fewer players after me">−</button>
        <input id="after" type="number" inputmode="numeric" min="0" max="${MAX_AFTER}" value="1" />
        <button id="more" type="button" aria-label="More players after me">+</button>
      </span>
    </label>
  </div>
  <div class="line" id="line"></div>
  <p class="answer" id="answer"></p>
  <p class="soft" id="odds"></p>
  <hr />
  <div class="row">
    <label>Someone guessed <input id="guess" type="number" inputmode="numeric" /></label>
    <button id="add" type="button">Add</button>
    <button id="undo" type="button" disabled>Undo</button>
  </div>
  <ul class="guesses" id="list"></ul>
  <details>
    <summary>How this works</summary>
    <p>Every guess owns the numbers it is closest to, and the secret number is taken to be anywhere in the range with equal chance. The grey curve is the share of the range you would own from each spot once the players still to come have taken the best spots left, breaking ties against you. The marker is the top of that curve.</p>
    <p>With nobody after you, the best spot hugs the neighbour on the wide side of the biggest gap. With players to come, it backs off to where squeezing you is no longer their best move.</p>
  </details>
  <footer><a href="https://github.com/sean-reid/random-game">Source</a> · <a href="https://sean-reid.github.io/blog/random-game.html">Why this works</a></footer>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const lo = $<HTMLInputElement>("lo");
const hi = $<HTMLInputElement>("hi");
const after = $<HTMLInputElement>("after");
const guess = $<HTMLInputElement>("guess");
const add = $<HTMLButtonElement>("add");
const undo = $<HTMLButtonElement>("undo");
const list = $<HTMLUListElement>("list");
const line = $<HTMLDivElement>("line");
const answer = $<HTMLParagraphElement>("answer");
const odds = $<HTMLParagraphElement>("odds");

function readRange(): boolean {
  const a = Number.parseInt(lo.value, 10);
  const b = Number.parseInt(hi.value, 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return false;
  state.lo = a;
  state.hi = b;
  state.guesses = state.guesses.filter((g) => g >= a && g <= b);
  return true;
}

function removeGuess(g: number): void {
  state.guesses = state.guesses.filter((v) => v !== g);
  render();
}

function renderList(): void {
  list.replaceChildren(
    ...state.guesses.map((g) => {
      const li = document.createElement("li");
      li.append(String(g));
      const x = document.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.setAttribute("aria-label", `Remove ${g}`);
      x.addEventListener("click", () => removeGuess(g));
      li.append(x);
      return li;
    }),
  );
  undo.disabled = state.guesses.length === 0;
}

function playersText(): string {
  if (state.after === 0) return "if nobody guesses after you";
  if (state.after === 1) return "after 1 more player takes the best spot";
  return `after ${state.after} more players take the best spots`;
}

function render(): void {
  renderList();
  if (!readRange()) {
    line.innerHTML = "";
    answer.textContent = "";
    odds.textContent = "The range needs a smaller first number and a larger second one.";
    return;
  }
  const r = recommend(state, state.after);
  line.innerHTML = renderLine(state, r, line.clientWidth);
  if (r.best === null) {
    answer.textContent = "";
    odds.textContent = "Every number is taken.";
    return;
  }
  answer.innerHTML = `Guess <em>${r.best}</em>`;
  odds.textContent = `${Math.round(r.bestWin * 100)}% chance to win ${playersText()}.`;
  guess.placeholder = String(r.best);
}

function addGuess(): void {
  const g = Number.parseInt(guess.value, 10);
  if (!Number.isFinite(g) || !readRange() || g < state.lo || g > state.hi) return;
  if (!state.guesses.includes(g)) state.guesses.push(g);
  guess.value = "";
  guess.focus();
  render();
}

function setAfter(k: number): void {
  state.after = Math.max(0, Math.min(MAX_AFTER, k));
  after.value = String(state.after);
  render();
}

add.addEventListener("click", addGuess);
guess.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addGuess();
});
undo.addEventListener("click", () => {
  state.guesses.pop();
  render();
});
for (const el of [lo, hi]) el.addEventListener("input", render);
after.addEventListener("input", () => {
  const k = Number.parseInt(after.value, 10);
  setAfter(Number.isFinite(k) ? k : 0);
});
$<HTMLButtonElement>("fewer").addEventListener("click", () => setAfter(state.after - 1));
$<HTMLButtonElement>("more").addEventListener("click", () => setAfter(state.after + 1));
line.addEventListener("pointerdown", (e) => {
  if (!readRange()) return;
  const rect = line.getBoundingClientRect();
  guess.value = String(numberAt(state, rect.width, e.clientX - rect.left));
  guess.focus();
});
new ResizeObserver(render).observe(line);

render();
