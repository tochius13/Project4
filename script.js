// ── DOM refs ──────────────────────────────────────────────────────
const testWrapper   = document.querySelector(".test-wrapper");
const testArea      = document.getElementById("test-area");
const resetBtn      = document.getElementById("reset");
const timerEl       = document.getElementById("timer");
const wpmEl         = document.getElementById("wpm-display");
const errorEl       = document.getElementById("error-display");
const ghostLabel    = document.getElementById("ghost-label");
const originP       = document.getElementById("origin-p");
const keyboardEl    = document.getElementById("keyboard");
const scoresListEl  = document.getElementById("scores-list");
const wpmChartEl    = document.getElementById("wpm-chart");
const scoresChartEl = document.getElementById("scores-chart");
const chartHint     = document.getElementById("chart-hint");

// ── Text pool (7 random paragraphs) ──────────────────────────────
const textPool = [
    "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.",
    "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.",
    "To be or not to be, that is the question. Whether tis nobler in the mind to suffer the slings and arrows of outrageous fortune.",
    "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
    "Call me Ishmael. Some years ago, never mind how long precisely, having little money in my purse, I thought I would sail about.",
    "The sky above the port was the color of television, tuned to a dead channel. Outside, the rain fell hard and steady.",
    "All happy families are alike; each unhappy family is unhappy in its own way. Everything was in confusion in the Oblonskys house."
];

// ── State ─────────────────────────────────────────────────────────
let timerInterval, ghostInterval, startTime;
let elapsedMs = 0, isRunning = false, isComplete = false;
let errorCount = 0, prevLen = 0, lastSec = -1;
let wpmHistory = [], charSpans = [], currentText = "";

// ── Add a leading zero to numbers 9 and below ────────────────────
const pad = n => n < 10 ? "0" + n : "" + n;

// ── Run a standard minute / second / hundredths timer ────────────
function formatTime(ms) {
    return `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms % 60000 / 1000))}:${pad(Math.floor(ms % 1000 / 10))}`;
}

function calcWPM() {
    const secs = elapsedMs / 1000;
    return secs < 0.5 ? 0 : Math.round((testArea.value.length / 5) / (secs / 60));
}

function startTimer() {
    startTime = Date.now() - elapsedMs;
    timerInterval = setInterval(() => {
        elapsedMs = Date.now() - startTime;
        timerEl.textContent = formatTime(elapsedMs);
        wpmEl.textContent = calcWPM();

        // Sample WPM once per second for the live chart
        const sec = Math.floor(elapsedMs / 1000);
        if (sec > lastSec) { lastSec = sec; wpmHistory.push({ sec, wpm: calcWPM() }); }

        drawWPMChart();
    }, 10);
    isRunning = true;
}

function stopTimer() { clearInterval(timerInterval); isRunning = false; }

// ── Render origin text as individual character spans ──────────────
function renderText(text) {
    currentText = text;
    charSpans = [];
    originP.innerHTML = "";
    for (let i = 0; i < text.length; i++) {
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = text[i] === " " ? "\u00A0" : text[i];
        originP.appendChild(span);
        charSpans.push(span);
    }
}

// ── Match the typed text against the origin text ──────────────────
function checkInput() {
    const typed = testArea.value;

    // Count errors — only increment when a new wrong character is added
    if (typed.length > prevLen) {
        const i = typed.length - 1;
        if (i < currentText.length && typed[i] !== currentText[i])
            errorEl.textContent = ++errorCount;
    }
    prevLen = typed.length;

    // Update each character span: correct / wrong / cursor
    charSpans.forEach((span, i) => {
        span.className = "char";
        if (i < typed.length)
            span.classList.add(typed[i] === currentText[i] ? "char-correct" : "char-wrong");
        else if (i === typed.length)
            span.classList.add("char-cursor");
    });

    // Update border color based on match state
    if (typed === currentText) {
        finishTest();
    } else if (currentText.startsWith(typed)) {
        testWrapper.style.borderColor = "#2196F3"; // correct so far — blue
    } else {
        testWrapper.style.borderColor = "#E95D0F"; // typo — orange/red
    }
}

// ── Stop the timer and save score on completion ───────────────────
function finishTest() {
    stopTimer();
    clearInterval(ghostInterval);
    charSpans.forEach(s => s.classList.remove("char-ghost"));
    isComplete = true;
    testWrapper.style.borderColor = "#4CAF50"; // green
    timerEl.classList.add("complete");

    // Save to localStorage
    const scores = JSON.parse(localStorage.getItem("typingTopScores") || "[]");
    scores.push({ time: elapsedMs, wpm: calcWPM(), date: new Date().toLocaleDateString() });
    scores.sort((a, b) => a.time - b.time);
    localStorage.setItem("typingTopScores", JSON.stringify(scores.slice(0, 3)));

    renderLeaderboard();
    drawScoresChart();
}

// ── Display top 3 scores from localStorage ────────────────────────
function renderLeaderboard() {
    const scores = JSON.parse(localStorage.getItem("typingTopScores") || "[]");
    if (!scores.length) {
        scoresListEl.innerHTML = `<p class="no-scores">No scores yet — finish a test to set a record!</p>`;
        return;
    }
    scoresListEl.innerHTML = scores.map((s, i) => `
        <div class="score-row">
            <span class="medal">${["🥇","🥈","🥉"][i]}</span>
            <span class="score-time">${formatTime(s.time)}</span>
            <span class="score-wpm">${s.wpm} WPM</span>
            <span class="score-date">${s.date || ""}</span>
        </div>`).join("");
}

// ── Live WPM line chart ───────────────────────────────────────────
function drawWPMChart() {
    if (wpmHistory.length < 2) return;

    const W = wpmChartEl.parentElement.clientWidth - 32 || 500;
    const H = 120;
    wpmChartEl.width = W;
    wpmChartEl.height = H;

    const ctx = wpmChartEl.getContext("2d");
    const [pL, pR, pT, pB] = [36, 12, 10, 22];
    const iW = W - pL - pR;
    const iH = H - pT - pB;
    const maxWPM = Math.max(...wpmHistory.map(d => d.wpm), 30);
    const maxSec = wpmHistory.at(-1).sec || 1;

    ctx.clearRect(0, 0, W, H);

    // Grid lines + Y-axis labels
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = pT + iH * (1 - i / 4);
        ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + iW, y); ctx.stroke();
        ctx.fillStyle = "#aaa"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
        ctx.fillText(Math.round(maxWPM * i / 4), pL - 4, y + 3);
    }

    // WPM line
    ctx.strokeStyle = "#2196F3"; ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath();
    wpmHistory.forEach((d, i) => {
        const x = pL + (d.sec / maxSec) * iW;
        const y = pT + iH * (1 - d.wpm / maxWPM);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under the line
    ctx.lineTo(pL + iW, pT + iH); ctx.lineTo(pL, pT + iH); ctx.closePath();
    ctx.fillStyle = "rgba(33,150,243,0.08)"; ctx.fill();

    if (chartHint) chartHint.style.display = "none";
}

// ── Top scores bar chart ──────────────────────────────────────────
function drawScoresChart() {
    const scores = JSON.parse(localStorage.getItem("typingTopScores") || "[]");
    if (!scores.length) return;

    const W = scoresChartEl.parentElement.clientWidth - 32 || 500;
    const H = 150;
    scoresChartEl.width = W;
    scoresChartEl.height = H;

    const ctx = scoresChartEl.getContext("2d");
    const [pL, pT, pB] = [10, 28, 28];
    const iW = W - pL * 2;
    const iH = H - pT - pB;
    const maxWPM = Math.max(...scores.map(s => s.wpm), 1);

    ctx.clearRect(0, 0, W, H);
    scores.forEach((s, i) => {
        const slot = iW / 3, bW = slot * 0.45;
        const x = pL + i * slot + (slot - bW) / 2;
        const bH = (s.wpm / maxWPM) * iH;
        ctx.fillStyle = ["#FFD700", "#C0C0C0", "#CD7F32"][i];
        ctx.fillRect(x, pT + iH - bH, bW, bH);
        ctx.fillStyle = "#333"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`${s.wpm} WPM`, x + bW / 2, pT + iH - bH - 6);
        ctx.fillStyle = "#666"; ctx.font = "11px sans-serif";
        ctx.fillText(["1st", "2nd", "3rd"][i], x + bW / 2, pT + iH + 18);
    });
}

// ── Ghost typer — pulsing amber cursor races at best saved speed ──
function startGhost() {
    const scores = JSON.parse(localStorage.getItem("typingTopScores") || "[]");
    const ghostWPM = scores.length ? scores[0].wpm : 60;
    ghostLabel.textContent = `${ghostWPM} WPM`;

    ghostInterval = setInterval(() => {
        charSpans.forEach(s => s.classList.remove("char-ghost"));
        const gPos = Math.floor(elapsedMs * (ghostWPM * 5) / 60000);
        if (gPos > testArea.value.length && gPos < charSpans.length)
            charSpans[gPos].classList.add("char-ghost");
    }, 80);
}

// ── Build virtual QWERTY keyboard ────────────────────────────────
const keyRows = [
    [{ k:"`" },{ k:"1" },{ k:"2" },{ k:"3" },{ k:"4" },{ k:"5" },{ k:"6" },{ k:"7" },{ k:"8" },{ k:"9" },{ k:"0" },{ k:"-" },{ k:"=" },{ k:"backspace", l:"⌫", c:"k-backspace" }],
    [{ k:"tab", l:"Tab", c:"k-tab" },{ k:"q" },{ k:"w" },{ k:"e" },{ k:"r" },{ k:"t" },{ k:"y" },{ k:"u" },{ k:"i" },{ k:"o" },{ k:"p" },{ k:"[" },{ k:"]" },{ k:"\\" }],
    [{ k:"capslock", l:"Caps", c:"k-capslock" },{ k:"a" },{ k:"s" },{ k:"d" },{ k:"f" },{ k:"g" },{ k:"h" },{ k:"j" },{ k:"k" },{ k:"l" },{ k:";" },{ k:"'" },{ k:"enter", l:"↵", c:"k-enter" }],
    [{ k:"shiftleft", l:"Shift", c:"k-shiftl" },{ k:"z" },{ k:"x" },{ k:"c" },{ k:"v" },{ k:"b" },{ k:"n" },{ k:"m" },{ k:"," },{ k:"." },{ k:"/" },{ k:"shiftright", l:"Shift", c:"k-shiftr" }],
    [{ k:" ", l:"Space", c:"k-space" }]
];

function buildKeyboard() {
    keyRows.forEach(row => {
        const rowEl = document.createElement("div");
        rowEl.className = "key-row";
        row.forEach(({ k, l, c }) => {
            const el = document.createElement("div");
            el.className = "key" + (c ? " " + c : "");
            el.textContent = l || k.toUpperCase();
            el.dataset.key = k;
            rowEl.appendChild(el);
        });
        keyboardEl.appendChild(rowEl);
    });
}

function flashKey(eventKey, isError) {
    const map = { " ": " ", Backspace: "backspace", Enter: "enter", Tab: "tab", CapsLock: "capslock", Shift: "shiftleft" };
    const k = map[eventKey] || eventKey.toLowerCase();
    const el = keyboardEl.querySelector(`[data-key="${k}"]`);
    if (!el) return;
    el.classList.remove("key-correct", "key-error");
    void el.offsetWidth; // force reflow so animation restarts
    el.classList.add(isError ? "key-error" : "key-correct");
    setTimeout(() => el.classList.remove("key-correct", "key-error"), 350);
}

// ── Reset everything and load a new random paragraph ─────────────
function resetTest() {
    stopTimer();
    clearInterval(ghostInterval);
    charSpans.forEach(s => s.classList.remove("char-ghost"));

    elapsedMs = 0; isRunning = false; isComplete = false;
    errorCount = 0; prevLen = 0; wpmHistory = []; lastSec = -1;

    testArea.value = "";
    timerEl.textContent = "00:00:00";
    timerEl.classList.remove("complete");
    wpmEl.textContent = "0";
    errorEl.textContent = "0";
    testWrapper.style.borderColor = "grey";
    if (chartHint) chartHint.style.display = "block";
    if (wpmChartEl) wpmChartEl.getContext("2d").clearRect(0, 0, wpmChartEl.width, wpmChartEl.height);

    // Pick a random text paragraph
    renderText(textPool[Math.floor(Math.random() * textPool.length)]);

    const scores = JSON.parse(localStorage.getItem("typingTopScores") || "[]");
    ghostLabel.textContent = `${scores.length ? scores[0].wpm : 60} WPM`;

    testArea.focus();
}

// ── Event listeners ───────────────────────────────────────────────
testArea.addEventListener("keydown", e => {
    if (e.key.length !== 1 && e.key !== "Backspace") return;
    const isError = e.key.length === 1 && !!currentText[testArea.value.length] && e.key !== currentText[testArea.value.length];
    flashKey(e.key, isError);
});

testArea.addEventListener("input", () => {
    if (isComplete) return;
    if (!isRunning && testArea.value.length > 0) { startTimer(); startGhost(); }
    checkInput();
});

resetBtn.addEventListener("click", resetTest);

// ── Init ──────────────────────────────────────────────────────────
buildKeyboard();
resetTest();
renderLeaderboard();
drawScoresChart();