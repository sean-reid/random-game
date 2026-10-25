# Random Game

Someone picks a number in a range, everyone guesses, closest wins. This tool tells you what to guess next and draws why on a number line: the stretch each guess owns, how much of the range you would own from every spot, and the best one marked. Tap the line to pick a number, set how many players still guess after you, and the answer updates. Name the guessers if you like, enter the number when it is revealed, and a scoreboard in your browser keeps the wins across rounds. The range and the guesses live in the URL, so a round can be shared.

Live at https://sean-reid.github.io/random-game/. The idea is written up at https://sean-reid.github.io/blog/random-game.html.

## How it decides

Every candidate guess owns the stretch of numbers it is closest to, and the secret number is assumed to be anywhere in the range with equal chance. With nobody left to guess after you, the best spot hugs the neighbour on the wide side of the biggest gap. With players still to come, the tool plays the rest of the round out a few hundred times, drawing each later player from a mix of three habits: bisect the biggest gap, guess anywhere, or hug a neighbour to take the most. It recommends the spot with the best average share and shows the share you keep in a bad round underneath. The mix starts at a stated guess and is refitted from the guesses you log at your own table, so it describes the people you actually play with rather than a survey.

## Development

```
npm install
npm run dev
npm test          # unit tests
npm run test:e2e  # Playwright, builds first
```

CI runs lint, format, typecheck, unit tests, build, a bundle-size budget, and Playwright at 375, 768, and 1280 wide. Pushes to main deploy to GitHub Pages.
