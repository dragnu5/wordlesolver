// ==UserScript==
// @name         Wordle Solver
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Solves Wordle. Includes Guessing Engine.
// @author       dragnu5
// @match        https://www.nytimes.com/games/wordle/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    // PASTE YOUR RAW JSON URL HERE
    const WORD_LIST_URL = "https://github.com/dragnu5/wordlesolver/raw/refs/heads/master/words.json";

    // --- STATE ---
    let fullWordList = [];
    let possibleWords = []; // Strict answers
    let bestWords = [];     // Answers sorted by likelihood
    let strategicWords = []; // Words to eliminate letters

    // UI State
    let showBest = true;      // Sort answers by letter freq?
    let showLists = false;    // Are lists visible?

    // --- INIT ---
    function init() {
        console.log("Wordle Solver: Initializing...");
        createUI();
        fetchWordList();
        waitForBoard();
    }

    // --- LOGIC: FETCH WORDS (JSON VERSION) ---
    function fetchWordList() {
        if (WORD_LIST_URL === "YOUR_JSON_URL_HERE") {
            updateStatus("Error: No URL set in script.");
            return;
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: WORD_LIST_URL,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        // PARSE JSON HERE
                        const rawList = JSON.parse(response.responseText);

                        // Sanitize (lowercase, trim, 5 chars only)
                        fullWordList = rawList
                        .map(w => w.trim().toLowerCase())
                        .filter(w => w.length === 5);

                        possibleWords = [...fullWordList];
                        updateStatus("Ready");
                        solve();
                    } catch (e) {
                        console.error(e);
                        updateStatus("Error parsing JSON.");
                    }
                } else {
                    updateStatus("Error fetching list.");
                }
            }
        });
    }

    // --- LOGIC: SCRAPE BOARD ---
    function getBoardState() {
        const board = document.querySelector('[class*="Board-module_board"]');
        if (!board) return null;

        const rows = board.querySelectorAll('[role="group"]');
        const constraints = {
            correct: Array(5).fill(null),
 present: [],
 absent: []
        };

        rows.forEach(row => {
            const tiles = row.querySelectorAll('div[data-state], div[data-testid="tile"]');
            tiles.forEach((tile, index) => {
                const letter = tile.textContent.toLowerCase();
                const state = tile.getAttribute('data-state');

                if (!letter || state === 'empty' || state === 'tbd') return;

                if (state === 'correct') {
                    constraints.correct[index] = letter;
                } else if (state === 'present') {
                    constraints.present.push({ char: letter, notAtIndex: index });
                } else if (state === 'absent') {
                    constraints.absent.push(letter);
                }
            });
        });

        return constraints;
    }

    // --- LOGIC: MAIN SOLVER ---
    function solve() {
        const state = getBoardState();
        if (!state) return;

        const { correct, present, absent } = state;

        // 1. Strict Solver Logic
        const knownLetters = new Set([...correct.filter(x => x), ...present.map(p => p.char)]);
        const strictAbsent = absent.filter(l => !knownLetters.has(l));

        possibleWords = fullWordList.filter(word => {
            for (let i = 0; i < 5; i++) {
                if (correct[i] && word[i] !== correct[i]) return false;
            }
            for (let p of present) {
                if (!word.includes(p.char)) return false;
                if (word[p.notAtIndex] === p.char) return false;
            }
            for (let a of strictAbsent) {
                if (word.includes(a)) return false;
            }
            return true;
        });

        calculateBestWords();
        calculateStrategicWords(state);
        updateUI();
    }

    // --- LOGIC: RANK POSSIBLE ANSWERS ---
    function calculateBestWords() {
        const freq = {};
        possibleWords.forEach(w => {
            [...new Set(w)].forEach(char => freq[char] = (freq[char] || 0) + 1);
        });

        bestWords = [...possibleWords].sort((a, b) => {
            const scoreA = [...new Set(a)].reduce((acc, c) => acc + (freq[c] || 0), 0);
            const scoreB = [...new Set(b)].reduce((acc, c) => acc + (freq[c] || 0), 0);
            return scoreB - scoreA;
        });
    }

    // --- LOGIC: STRATEGIC ELIMINATORS ---
    function calculateStrategicWords(state) {
        // Frequency of letters in REMAINING answers
        const freq = {};
        possibleWords.forEach(w => {
            [...new Set(w)].forEach(char => freq[char] = (freq[char] || 0) + 1);
        });

        const { correct, present, absent } = state;
        const knownSet = new Set([...correct, ...present.map(p => p.char)].filter(x => x));
        const bannedSet = new Set(absent);

        // Score ALL words
        strategicWords = fullWordList.map(word => {
            let score = 0;
            const uniqueChars = new Set(word);

            uniqueChars.forEach(char => {
                if (bannedSet.has(char)) {
                    score -= 5; // Avoid dead letters
                } else if (knownSet.has(char)) {
                    score += 0; // Ignore knowns
                } else {
                    score += (freq[char] || 0); // Reward high freq unknowns
                }
            });

            return { word, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map(o => o.word);
    }

    // --- UI: RENDER ---
    function createUI() {
        const container = document.createElement('div');
        container.id = 'wordle-solver-sidebar';
        container.style.cssText = `
        position: fixed; top: 10%; right: 0; width: 260px;
        background: #121213; color: white; border: 1px solid #3a3a3c;
        font-family: 'Helvetica Neue', Arial, sans-serif; z-index: 99999;
        padding: 10px; border-radius: 8px 0 0 8px;
        box-shadow: -2px 2px 10px rgba(0,0,0,0.5);
        display: flex; flex-direction: column; gap: 8px;
        `;

        container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3a3a3c; padding-bottom:5px;">
        <h3 style="margin:0; font-size:16px;">Words</h3>
        <div style="display:flex; gap:5px;">
        <button id="ws-toggle-sort" style="background:#3a3a3c; border:none; color:white; padding:4px 6px; cursor:pointer; font-size:11px; border-radius:4px;">Sort: Best</button>
        <button id="ws-toggle-vis" style="background:#538d4e; border:none; color:white; padding:4px 6px; cursor:pointer; font-size:11px; border-radius:4px;">Expand</button>
        </div>
        </div>

        <div id="ws-stats" style="font-size:14px; color:#818384;">Initializing...</div>

        <div id="ws-lists-container" style="display:none; flex-direction:column; gap:10px;">
        <div>
        <div style="font-size:12px; color:#538d4e; font-weight:bold; margin-bottom:4px;">POSSIBLE ANSWERS</div>
        <div id="ws-list" style="height: 150px; overflow-y: auto; font-family: monospace; font-size: 14px; border: 1px solid #3a3a3c; padding:5px;"></div>
        </div>

        <div>
        <div style="font-size:12px; color:#b59f3b; font-weight:bold; margin-bottom:4px;">STRATEGIC GUESSES</div>
        <div style="font-size:10px; color:#818384; margin-bottom:4px;">Eliminate common letters</div>
        <div id="ws-strat-list" style="height: 100px; overflow-y: auto; font-family: monospace; font-size: 14px; border: 1px solid #3a3a3c; padding:5px;"></div>
        </div>
        </div>
        `;

        document.body.appendChild(container);

        document.getElementById('ws-toggle-sort').addEventListener('click', (e) => {
            e.stopPropagation();
            showBest = !showBest;
            updateUI();
        });

        document.getElementById('ws-toggle-vis').addEventListener('click', (e) => {
            e.stopPropagation();
            showLists = !showLists;
            updateUI();
        });
    }

    function updateStatus(msg) {
        const stats = document.getElementById('ws-stats');
        if (stats) stats.innerText = msg;
    }

    function updateUI() {
        const stats = document.getElementById('ws-stats');
        const listContainer = document.getElementById('ws-lists-container');
        const listMain = document.getElementById('ws-list');
        const listStrat = document.getElementById('ws-strat-list');
        const btnVis = document.getElementById('ws-toggle-vis');
        const btnSort = document.getElementById('ws-toggle-sort');

        if(!stats) return;

        stats.innerHTML = `Found: <strong style="color:white">${possibleWords.length}</strong> possible`;
        btnVis.innerText = showLists ? "Collapse" : "Expand";
        btnSort.innerText = showBest ? "Sort: Best" : "Sort: A-Z";

        listContainer.style.display = showLists ? "flex" : "none";

        if (!showLists) return;

        // 1. Possible Answers
        const sourceList = showBest ? bestWords : possibleWords;
        listMain.innerHTML = sourceList.slice(0, 100).map((w, i) => {
            const style = (i === 0 && showBest) ? "color: #538d4e; font-weight:bold;" : "color: #d7dadc;";
            return `<div style="${style}">${i+1}. ${w}</div>`;
        }).join('');

        if (possibleWords.length > 100) {
            listMain.innerHTML += `<div style="color:#818384;">...and ${possibleWords.length - 100} more</div>`;
        }

        // 2. Strategic Guesses
        listStrat.innerHTML = strategicWords.map((w, i) => {
            return `<div style="color: #d7dadc;">${i+1}. ${w}</div>`;
        }).join('');
    }

    // --- EVENT LISTENERS ---
    function waitForBoard() {
        const checkInterval = setInterval(() => {
            const board = document.querySelector('[class*="Board-module_board"]');
            if (board) {
                clearInterval(checkInterval);
                observeBoard(board);
                solve();
            }
        }, 500);
    }

    function observeBoard(boardNode) {
        const config = { attributes: true, childList: true, subtree: true };
        const callback = function(mutationsList) {
            const isSidebarChange = mutationsList.some(m =>
            m.target.closest && m.target.closest('#wordle-solver-sidebar')
            );
            if (isSidebarChange) return;

            if (window.solveTimeout) clearTimeout(window.solveTimeout);
            window.solveTimeout = setTimeout(solve, 500);
        };
        const observer = new MutationObserver(callback);
        observer.observe(boardNode, config);
    }

    // --- RUN ---
    window.addEventListener('load', init);
    setTimeout(() => {
        if (!document.getElementById('wordle-solver-sidebar')) init();
    }, 1500);

})();
