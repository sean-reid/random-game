import "./style.css";
import { clampAfter, fitMix, MAX_AFTER, recommend, winEach, winners, type Mix } from "./engine";
import {
  boardOf,
  cleanName,
  fromQuery,
  inRange,
  NAME_MAX,
  parseRange,
  toQuery,
  type State,
} from "./state/query";
import {
  loadRounds,
  loadTally,
  observationsOf,
  recordRound,
  safeStorage,
  saveRounds,
  saveTally,
  type RoundLog,
  type Tally,
} from "./state/storage";
import { mixText, oddsText, resultText } from "./ui/copy";
import { mount, renderChips, renderNames, renderTally } from "./ui/dom";
import { numberAt, renderLine } from "./ui/line";

const storage = safeStorage(() => localStorage);
const state: State = fromQuery(location.search);
let tally: Tally = loadTally(storage);
let rounds: RoundLog[] = loadRounds(storage);
let mix: Mix = fitMix(observationsOf(rounds));
let revealed: number | null = null;
let current: number | null = null;

const el = mount(document.getElementById("app") as HTMLElement, MAX_AFTER, NAME_MAX);
el.lo.value = String(state.lo);
el.hi.value = String(state.hi);
el.after.value = String(state.after);

function say(message: string): void {
  el.note.textContent = message;
}

function syncUrl(): void {
  history.replaceState(null, "", `${location.pathname}${toQuery(state)}`);
}

function knownNames(): string[] {
  return [...new Set([...Object.keys(tally), ...state.guesses.map((g) => g.name)])].filter(Boolean);
}

function removeGuess(g: { n: number }): void {
  state.guesses = state.guesses.filter((v) => v !== g);
  render();
}

function render(): void {
  const range = parseRange(el.lo.value, el.hi.value);
  if (range) {
    state.lo = range.lo;
    state.hi = range.hi;
  }
  const locked = revealed !== null;
  renderTally(el.tally, el.board, tally);
  renderNames(el.names, knownNames());
  syncUrl();
  el.mix.textContent = mixText(mix, observationsOf(rounds).length);
  el.fewer.disabled = state.after === 0;
  el.more.disabled = state.after === MAX_AFTER;
  el.undo.disabled = state.guesses.length === 0 || locked;
  el.add.disabled = locked;
  for (const input of [el.lo, el.hi]) input.setAttribute("aria-invalid", range ? "false" : "true");
  if (!range) {
    renderChips(el.list, state.guesses, state, new Map(), locked, removeGuess);
    el.line.innerHTML = "";
    el.answer.textContent = "";
    current = null;
    el.guess.placeholder = "";
    el.odds.textContent = "The range needs a smaller first number and a larger second one.";
    return;
  }
  const b = boardOf(state);
  const r = recommend(b, state.after, mix, current);
  current = r.best;
  const placed = r.best !== null && !locked ? [...b.guesses, r.best] : b.guesses;
  const shares = winEach(
    [...placed].sort((a, c) => a - c),
    b,
  );
  renderChips(el.list, state.guesses, state, shares, locked, removeGuess);
  const labels = new Map(state.guesses.filter((g) => g.name).map((g) => [g.n, g.name]));
  el.line.innerHTML = renderLine(b, r, el.line.clientWidth, labels, revealed);
  el.answer.hidden = locked;
  el.odds.hidden = locked;
  if (r.best === null) {
    el.answer.textContent = "";
    el.guess.placeholder = "";
    el.odds.textContent = "Every number is taken.";
    return;
  }
  el.answer.innerHTML = `Guess <em>${r.best}</em>`;
  el.odds.textContent = oddsText(state.after, r.bestWin, r.bestLow);
  el.guess.placeholder = String(r.best);
}

function pruneOutside(): void {
  state.guesses = state.guesses.filter((g) => inRange(state, g.n));
  render();
}

function addGuess(): void {
  if (revealed !== null) return;
  const n = Number.parseInt(el.guess.value, 10);
  if (!Number.isSafeInteger(n)) return say("Type a whole number to add.");
  if (!parseRange(el.lo.value, el.hi.value)) return say("Fix the range first.");
  if (!inRange(state, n)) return say(`${n} is outside ${state.lo} to ${state.hi}.`);
  if (state.guesses.some((g) => g.n === n)) return say(`${n} is already taken.`);
  const g = { n, name: cleanName(el.name.value) };
  state.guesses.push(el.mine.checked ? { ...g, mine: true } : g);
  say("");
  el.guess.value = "";
  el.name.value = "";
  el.mine.checked = false;
  el.name.focus();
  render();
}

function setAfter(k: number): void {
  state.after = clampAfter(k);
  el.after.value = String(state.after);
  render();
}

function revealSecret(): void {
  if (revealed !== null) return;
  const n = Number.parseInt(el.secret.value, 10);
  if (!Number.isSafeInteger(n)) return say("Type the number that was picked.");
  if (!parseRange(el.lo.value, el.hi.value)) return say("Fix the range first.");
  if (!inRange(state, n)) return say(`${n} is outside ${state.lo} to ${state.hi}.`);
  say("");
  state.guesses = state.guesses.filter((g) => inRange(state, g.n));
  revealed = n;
  const won = winners(state.guesses, n);
  el.result.textContent = resultText(won, n);
  const named = state.guesses.map((g) => g.name).filter(Boolean);
  if (named.length) {
    tally = recordRound(tally, named, won.map((g) => g.name).filter(Boolean));
    saveTally(storage, tally);
  }
  if (state.guesses.some((g) => !g.mine)) {
    rounds = [
      ...rounds,
      {
        lo: state.lo,
        hi: state.hi,
        guesses: state.guesses.map((g) => g.n),
        theirs: state.guesses.map((g) => !g.mine),
      },
    ];
    saveRounds(storage, rounds);
    mix = fitMix(observationsOf(rounds));
  }
  el.reveal.hidden = true;
  el.next.hidden = false;
  render();
  el.next.focus();
}

function newRound(): void {
  state.guesses = [];
  revealed = null;
  el.secret.value = "";
  el.result.textContent = "";
  el.reveal.hidden = false;
  el.next.hidden = true;
  render();
  el.name.focus();
}

function clearLearned(): void {
  tally = loadTally({ getItem: () => null });
  saveTally(storage, tally);
  rounds = [];
  saveRounds(storage, rounds);
  mix = fitMix([]);
  render();
  el.name.focus();
}

el.add.addEventListener("click", addGuess);
for (const input of [el.guess, el.name]) {
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addGuess();
  });
}
el.guess.addEventListener("input", () => {
  el.mine.checked = current !== null && Number.parseInt(el.guess.value, 10) === current;
});
// Focus moves to New round during the handler, so the default Enter action must not reach it.
el.secret.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  revealSecret();
});
el.reveal.addEventListener("click", revealSecret);
el.next.addEventListener("click", newRound);
el.reset.addEventListener("click", clearLearned);
el.undo.addEventListener("click", () => {
  if (revealed !== null) return;
  state.guesses.pop();
  render();
});
for (const input of [el.lo, el.hi]) {
  input.addEventListener("input", render);
  input.addEventListener("change", pruneOutside);
}
el.after.addEventListener("input", () => {
  if (el.after.value === "") return;
  setAfter(Number.parseInt(el.after.value, 10));
});
el.after.addEventListener("change", () => setAfter(Number.parseInt(el.after.value, 10)));
el.fewer.addEventListener("click", () => setAfter(state.after - 1));
el.more.addEventListener("click", () => setAfter(state.after + 1));
el.line.addEventListener("pointerdown", (e) => {
  if (revealed !== null || !parseRange(el.lo.value, el.hi.value)) return;
  const rect = el.line.getBoundingClientRect();
  el.guess.value = String(numberAt(state, rect.width, e.clientX - rect.left));
  el.guess.dispatchEvent(new Event("input"));
  el.guess.focus();
});
new ResizeObserver(render).observe(el.line);

render();
