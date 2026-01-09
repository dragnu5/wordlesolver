# Wordle Solver & Helper Userscript

A lightweight userscript interface for the NYT Wordle game. Built to experiment with overlay UX and visualized sorting algorithms.
## Features

- Auto-Solver: Instantly filters words based on board state (Green/Yellow/Grey).
- Dual Strategies:
	- Possible Answers: Strict list of potential solutions.
	- Strategic Guesses: Words optimized to eliminate the most remaining letters.

- Reactive UI: Collapsible sidebar that updates automatically as you play.
- Custom Dictionary: Supports external JSON wordlists.

Installation

1. Install a userscript manager (e.g., Violentmonkey)

2. [Click to install.](https://raw.githubusercontent.com/dragnu5/wordlesolver/master/wordlesolver.user.js)
3. Optional: Replace JSON Path at the top of the script with a raw link to your JSON wordlist (format: ["word1", "word2"]).

Usage

    Open NYT Wordle.

    The "Solver" sidebar will appear on the right.

    Click Expand to see the lists.

    Play as normal; the script updates automatically after every guess.
