# Random Game

Someone picks a number in a range, everyone guesses, closest wins. This tool tells you what to guess next and draws why on a number line: the stretch each guess owns, how much of the range you would own from every spot, and the best one marked. Tap the line to pick a number, set how many players still guess after you, and the answer updates. Name the guessers if you like, tick "that's me" on your own guess, and enter the number when it is revealed: the winner is named, a scoreboard in this browser keeps wins and rounds per name, and the recommendation gives way to the secret on the line. The range, the guesses with their names, and the players-after count live in the URL, so a round can be shared.

Live at https://sean-reid.github.io/random-game/. The idea is written up at https://sean-reid.github.io/blog/random-game.html.

## How it decides

Every candidate guess owns the stretch of numbers it is closest to, and the secret number is assumed to be anywhere in the range with equal chance. With nobody left to guess after you, the best spot hugs the neighbour on the wide side of the biggest gap. With players still to come, the tool plays the rest of the round out a few hundred times, drawing each later player from a mix of three habits: bisect the biggest gap, guess anywhere, or hug a neighbour to take the most. It recommends the spot with the best average share and shows the share you keep in a bad round underneath. The mix starts at a stated guess and is refitted from the other players' guesses in the rounds you reveal, the latest 200, kept in this browser, so it describes the people you actually play with rather than a survey. Clearing the scoreboard forgets those rounds too.

## Development

Node 24 (see .nvmrc).

```
npm install
npm run dev
npm test                               # unit tests
npx playwright install chromium        # once
npm run test:e2e                       # Playwright, builds first
npm run lint && npm run format:check && npm run typecheck && npm run build && npm run size
```

CI runs that last line plus the unit tests, a dependency audit, and Playwright at 375, 768, and 1280 wide. Pushes to main deploy to GitHub Pages.
