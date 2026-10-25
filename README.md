# Random Game

Someone picks a number in a range, everyone guesses, closest wins. This tool tells you what to guess next and draws why on a number line: the stretch each guess owns, how much of the range you would own from every spot, and the best one marked. Tap the line to pick a number, set how many players still guess after you, and the answer updates.

Live at https://sean-reid.github.io/random-game/. The idea is written up at https://sean-reid.github.io/blog/random-game.html.

## How it decides

Every candidate guess owns the stretch of numbers it is closest to, and the secret number is assumed to be anywhere in the range with equal chance. The tool scores each candidate by the size of its stretch, then picks the best. With nobody left to guess after you, that means hugging the neighbour on the wide side of the biggest gap. With players still to come, the tool plays them out, each taking the best remaining spot, and picks the guess that holds up.

## Development

```
npm install
npm run dev
npm test          # unit tests
npm run test:e2e  # Playwright, builds first
```

CI runs lint, format, typecheck, unit tests, build, a bundle-size budget, and Playwright at 375, 768, and 1280 wide. Pushes to main deploy to GitHub Pages.
