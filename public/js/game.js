const socket = io();

const params = new URLSearchParams(window.location.search);
const roomCode = params.get("room");
const playerToken = localStorage.getItem("imposterInkPlayerToken");

// =============================
// ELEMENTS
// =============================

const roleScreen = document.getElementById("roleScreen");
const drawingScreen = document.getElementById("drawingScreen");
const votingScreen = document.getElementById("votingScreen");
const resultsScreen = document.getElementById("resultsScreen");
const roleCard = document.getElementById("playerRole");
const roleIcon = document.getElementById("roleIcon");
const roleLabel = document.getElementById("roleLabel");
const secretInfo = document.getElementById("secretInfo");
const roleDescription = document.getElementById("roleDescription");
const roundNumber = document.getElementById("roundNumber");
const scoreNumber = document.getElementById("scoreNumber");
const readyBtn = document.getElementById("readyBtn");
const readyStatus = document.getElementById("readyStatus");
const turnPlayer = document.getElementById("turnPlayer");
const turnStatus = document.getElementById("turnStatus");
const timer = document.getElementById("timer");
const canvas = document.getElementById("drawingCanvas");
const brushSize = document.getElementById("brushSize");
const brushColor = document.getElementById("brushColor");
const clearCanvas = document.getElementById("clearCanvas");
const voteStatus = document.getElementById("voteStatus");
const playersGrid = document.getElementById("playersGrid");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const nextRoundStatus = document.getElementById("nextRoundStatus");
const resultsIcon = document.getElementById("resultsIcon");
const resultsTitle = document.getElementById("resultsTitle");
const resultsMessage = document.getElementById("resultsMessage");
const resultsPlayers = document.getElementById("resultsPlayers");
const playAgainBtn = document.getElementById("playAgainBtn");
const homeBtn = document.getElementById("homeBtn");
const backBtn = document.getElementById("backBtn");
const rulesBtn = document.getElementById("rulesBtn");
const rulesModal = document.getElementById("rulesModal");
const closeRulesBtn = document.getElementById("closeRulesBtn");
const rulesBackdrop = document.getElementById("rulesBackdrop");
const guessPanel = document.getElementById("guessPanel");
const guessInput = document.getElementById("guessInput");
const guessBtn = document.getElementById("guessBtn");
const guessFeedback = document.getElementById("guessFeedback");
const votingGuessPanel = document.getElementById("votingGuessPanel");
const votingGuessInput = document.getElementById("votingGuessInput");
const votingGuessBtn = document.getElementById("votingGuessBtn");
const votingGuessFeedback = document.getElementById("votingGuessFeedback");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const voteChatMessages = document.getElementById("voteChatMessages");
const voteChatForm = document.getElementById("voteChatForm");
const voteChatInput = document.getElementById("voteChatInput");
const leaveModal = document.getElementById("leaveModal");
const leaveBackdrop = document.getElementById("leaveBackdrop");
const cancelLeaveBtn = document.getElementById("cancelLeaveBtn");
const confirmLeaveBtn = document.getElementById("confirmLeaveBtn");
let selectedVoteToken = null;
let hasVoted = false;
let hasSkippedVote = false;
let myRole = null;

function requestGameData() {
    if (!roomCode || !playerToken) {
        showGameToast("Missing room or player information. Returning home...", "error");
        setTimeout(() => { window.location.href = "/"; }, 1200);
        return;
    }

    socket.emit("getGameData", { roomCode, playerToken });
}

socket.on("connect", requestGameData);

function openRules() {
    rulesModal.classList.remove("hidden");
}

function closeRules() {
    rulesModal.classList.add("hidden");
}

rulesBtn?.addEventListener("click", openRules);
closeRulesBtn?.addEventListener("click", closeRules);
rulesBackdrop?.addEventListener("click", closeRules);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRules();
});

function renderChatMessage(container, data) {
    if (!container) return;
    const row = document.createElement("div");
    row.className = "chat-message";
    if (data.playerToken === playerToken) row.classList.add("mine");

    const meta = document.createElement("div");
    meta.className = "chat-meta";
    meta.textContent = data.playerToken === playerToken ? "YOU" : data.playerName;

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.textContent = data.message;

    row.append(meta, bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function addChatMessage(data) {
    renderChatMessage(chatMessages, data);
    renderChatMessage(voteChatMessages, data);
}

function sendChatFrom(input) {
    const message = input?.value.trim();
    if (!message) return;
    socket.emit("sendChat", { roomCode, playerToken, message });
    input.value = "";
    input.focus();
}

chatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatFrom(chatInput);
});

voteChatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatFrom(voteChatInput);
});

socket.on("chatMessage", addChatMessage);
socket.on("chatRejected", (data) => {
    showGameToast(data?.message || "That message cannot be sent.", "warning");
});

function submitGuess(input = guessInput, button = guessBtn, feedback = guessFeedback) {
    const guess = input?.value.trim();
    if (!guess || !button || !feedback) return;

    button.disabled = true;
    feedback.textContent = "Checking...";
    socket.emit("guessWord", { roomCode, playerToken, guess });
}

guessBtn?.addEventListener("click", () => submitGuess());
guessInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitGuess();
});

votingGuessBtn?.addEventListener("click", () => submitGuess(votingGuessInput, votingGuessBtn, votingGuessFeedback));
votingGuessInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitGuess(votingGuessInput, votingGuessBtn, votingGuessFeedback);
});

socket.on("guessResult", (data) => {
    const activeButton = votingScreen && !votingScreen.classList.contains("hidden")
        ? votingGuessBtn
        : guessBtn;
    const activeInput = votingScreen && !votingScreen.classList.contains("hidden")
        ? votingGuessInput
        : guessInput;
    const activeFeedback = votingScreen && !votingScreen.classList.contains("hidden")
        ? votingGuessFeedback
        : guessFeedback;

    if (activeButton) activeButton.disabled = false;
    if (activeFeedback) activeFeedback.textContent = data.message;
    activeInput?.select();
});

socket.on("imposterGuessedWord", (data) => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    canDraw = false;
    drawing = false;
    drawingScreen.classList.add("hidden");
    votingScreen.classList.add("hidden");
    votingGuessPanel?.classList.add("hidden");
    resultsScreen.classList.remove("hidden");
    resultsIcon.textContent = "!";
    resultsIcon.classList.remove("success");
    resultsIcon.classList.add("danger");
    resultsTitle.textContent = "The imposter cracked it!";
    resultsMessage.textContent = `${data.guesserName} guessed the secret word correctly. The imposter wins! The word was ${data.word}.`;
    resultsPlayers.innerHTML = "";
    (data.players || []).forEach(player => {
        const row = document.createElement("div");
        row.className = "result-player-row";
        if (player.imposter) row.classList.add("actual-imposter");

        const left = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = player.name;
        const role = document.createElement("span");
        role.textContent = player.imposter ? "IMPOSTER" : "PLAYER";
        left.append(name, role);

        const score = document.createElement("b");
        score.className = "result-score";
        score.textContent = `+${player.points || 0} XP · ${player.score || 0} TOTAL`;
        row.append(left, score);
        resultsPlayers.appendChild(row);
    });
    playAgainBtn.disabled = false;
    playAgainBtn.textContent = "PLAY AGAIN";
});

// =============================
// CANVAS SETUP
// =============================

const ctx = canvas.getContext("2d");

let drawing = false;
let canDraw = false;
let timerInterval = null;
let canvasWidth = 0;
let canvasHeight = 0;
let dpr = window.devicePixelRatio || 1;

function setupContext() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
}

setupContext();

// =============================
// RESIZE CANVAS
// =============================

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
        return;
    }

    const newWidth = Math.round(rect.width);
    const newHeight = Math.round(rect.height);
    const newDpr = window.devicePixelRatio || 1;

    if (
        canvasWidth === newWidth &&
        canvasHeight === newHeight &&
        dpr === newDpr &&
        canvas.width > 0 &&
        canvas.height > 0
    ) {
        return;
    }

    // Preserve the existing drawing before resizing.
    const oldCanvas = document.createElement("canvas");
    oldCanvas.width = canvas.width;
    oldCanvas.height = canvas.height;

    if (canvas.width > 0 && canvas.height > 0) {
        const oldCtx = oldCanvas.getContext("2d");
        oldCtx.drawImage(canvas, 0, 0);
    }

    canvasWidth = newWidth;
    canvasHeight = newHeight;
    dpr = newDpr;

    canvas.width = Math.max(1, Math.round(canvasWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvasHeight * dpr));

    // All drawing coordinates are kept in CSS pixels.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setupContext();

    if (oldCanvas.width > 0 && oldCanvas.height > 0) {
        ctx.drawImage(
            oldCanvas,
            0,
            0,
            oldCanvas.width,
            oldCanvas.height,
            0,
            0,
            canvasWidth,
            canvasHeight
        );
    }

    console.log("Canvas ready:", canvasWidth, "x", canvasHeight, "DPR:", dpr);
}

window.addEventListener("resize", resizeCanvas);

const canvasObserver = new ResizeObserver(() => {
    resizeCanvas();
});

canvasObserver.observe(canvas);

const canvasContainer = document.querySelector(".canvas-container");

if (canvasContainer) {
    canvasObserver.observe(canvasContainer);
}

window.addEventListener("load", () => {
    setTimeout(resizeCanvas, 100);
});

// =============================
// GAME STARTED
// =============================

socket.on("gameStarted", (data) => {
    console.log("Private game data received:", data.role);

    roundNumber.textContent = data.round;
    if (scoreNumber && data.score !== undefined) scoreNumber.textContent = data.score;
    myRole = data.role;

    guessPanel.classList.toggle("hidden", data.role !== "imposter");
    votingGuessPanel?.classList.toggle("hidden", data.role !== "imposter");
    voteChatMessages.innerHTML = "";
    chatMessages.innerHTML = "";
    if (data.role === "imposter") {
        roleCard.classList.add("imposter");
        roleIcon.textContent = "!";
        roleLabel.textContent = "YOU ARE THE IMPOSTER";
        secretInfo.textContent = data.clue;
        roleDescription.textContent = "Find the secret word without being discovered.";
        readyBtn.disabled = false;
        readyBtn.textContent = "I'M READY";
    } else if (data.role === "eliminated") {
        roleCard.classList.remove("imposter");
        roleIcon.textContent = "✕";
        roleLabel.textContent = "YOU WERE CAUGHT";
        secretInfo.textContent = "SPECTATOR MODE";
        roleDescription.textContent = "You are out of this match. Watch the remaining players.";
        readyBtn.disabled = true;
        readyBtn.textContent = "ELIMINATED";
        readyStatus.textContent = "You can watch the rest of the match.";
    } else {
        roleCard.classList.remove("imposter");
        roleIcon.textContent = "✦";
        roleLabel.textContent = "YOUR SECRET WORD";
        secretInfo.textContent = data.word;
        roleDescription.textContent = "Draw carefully. Don't make the word too obvious.";
        readyBtn.disabled = false;
        readyBtn.textContent = "I'M READY";
    }

    if (data.readyCount !== undefined && data.role !== "eliminated") {
        readyStatus.textContent = `Ready: ${data.readyCount}/${data.playerCount}`;
    }
});

// =============================
// READY
// =============================

readyBtn.addEventListener("click", () => {
    readyBtn.textContent = "READY ✓";
    readyBtn.disabled = true;

    socket.emit("playerReady", {
        roomCode,
        playerToken
    });
});

socket.on("readyUpdate", (data) => {
    readyStatus.textContent = `Ready: ${data.readyCount}/${data.playerCount}`;

    if (data.readyCount === data.playerCount) {
        readyBtn.textContent = "STARTING...";
    }
});

// =============================
// DRAWING TURN
// =============================

socket.on("drawingTurnStarted", (data) => {
    console.log("Drawing turn:", data.currentPlayerName);

    roleScreen.classList.add("hidden");
    drawingScreen.classList.remove("hidden");

    requestAnimationFrame(() => {
        resizeCanvas();
    });

    turnPlayer.textContent = data.currentPlayerName;

    canDraw = data.currentPlayerToken === playerToken;
    drawing = false;
    guessInput.value = "";
    guessFeedback.textContent = "";
    guessBtn.disabled = false;
    if (votingGuessInput) votingGuessInput.value = "";
    if (votingGuessFeedback) votingGuessFeedback.textContent = "";
    if (votingGuessBtn) votingGuessBtn.disabled = false;

    if (canDraw) {
        turnStatus.textContent = "🔥 YOUR TURN — DRAW THE WORD";
        turnStatus.style.color = "#111";
        turnStatus.style.background = "#a98cff";
        canvas.style.cursor = "crosshair";
    } else {
        turnStatus.textContent = `👀 ${data.currentPlayerName} is drawing`;
        turnStatus.style.color = "#bcaeff";
        turnStatus.style.background = "rgba(169,140,255,0.08)";
        canvas.style.cursor = "default";
    }

    startTimer(data.turnEndsAt);
});

// =============================
// TIMER
// =============================

function startTimer(endTime) {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    function updateTimer() {
        const remaining = Math.max(0, endTime - Date.now());
        const seconds = Math.ceil(remaining / 1000);

        timer.textContent = seconds;
        timer.style.color = seconds <= 5 ? "#ff8585" : "white";

        if (remaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            timer.textContent = "0";
        }
    }

    updateTimer();
    timerInterval = setInterval(updateTimer, 100);
}

// =============================
// CANVAS POSITION
// =============================

function getCanvasPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

// =============================
// DRAWING STYLE
// =============================

function applyBrushStyle(size, color) {
    ctx.strokeStyle = color || "#111111";
    ctx.fillStyle = color || "#111111";
    ctx.lineWidth = Number(size) || 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
}

// =============================
// START DRAWING
// =============================

canvas.addEventListener("pointerdown", (event) => {
    if (!canDraw) {
        return;
    }


    // IMPORTANT: calculate the position before using it.
    const pos = getCanvasPosition(event);

    drawing = true;
    canvas.setPointerCapture(event.pointerId);

    const activeSize = Number(brushSize.value);
    const activeColor = brushColor.value;

    applyBrushStyle(activeSize, activeColor);

    // Start a fresh stroke.
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    // Draw a tiny dot so a click without movement is still visible.
    ctx.arc(pos.x, pos.y, Math.max(1, Number(brushSize.value) / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    socket.emit("drawStart", {
        roomCode,
        playerToken,
        x: pos.x,
        y: pos.y,
        size: activeSize,
        color: activeColor
    });
});

// =============================
// DRAW
// =============================

canvas.addEventListener("pointermove", (event) => {
    if (!drawing || !canDraw) {
        return;
    }

    const pos = getCanvasPosition(event);

    const activeSize = Number(brushSize.value);
    const activeColor = brushColor.value;

    drawLine(pos.x, pos.y, activeSize, activeColor);

    socket.emit("drawMove", {
        roomCode,
        playerToken,
        x: pos.x,
        y: pos.y
    });
});

// =============================
// STOP DRAWING
// =============================

function stopDrawing(event) {
    if (!drawing) {
        return;
    }

    drawing = false;
    ctx.closePath();

    if (event && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
    }
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointerleave", (event) => {
    // Pointer capture normally keeps drawing active outside the canvas.
    // This handler is intentionally light and does not end the stroke.
});

// =============================
// LOCAL DRAW
// =============================

function drawLine(x, y, size, color) {
    applyBrushStyle(size, color);

    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y);
}

// =============================
// RECEIVE DRAW START
// =============================

socket.on("drawStart", (data) => {
    if (data.playerToken === playerToken) {
        return;
    }

    applyBrushStyle(data.size, data.color);
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);

    // Show the first click/point for remote players too.
    ctx.arc(
        data.x,
        data.y,
        Math.max(1, (Number(data.size) || 5) / 2),
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

// =============================
// RECEIVE DRAW MOVE
// =============================

socket.on("drawMove", (data) => {
    if (data.playerToken === playerToken) {
        return;
    }

    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

// =============================
// CLEAR CANVAS
// =============================

clearCanvas.addEventListener("click", () => {
    if (!canDraw) {
        return;
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    socket.emit("clearCanvas", {
        roomCode,
        playerToken
    });
});

socket.on("clearCanvas", (data) => {
    if (data.playerToken === playerToken) {
        return;
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
});

// =============================
// DRAWING FINISHED
// =============================

socket.on("drawingPhaseFinished", () => {
    console.log("Drawing phase finished.");

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    timer.textContent = "0";
    turnStatus.textContent = "DRAWING COMPLETE";
    canDraw = false;
    drawing = false;
    guessPanel.classList.add("hidden");
    votingGuessPanel?.classList.add("hidden");
});

// =============================
// VOTING PHASE
// =============================

socket.on("votingStarted", (data) => {
    console.log("Voting started:", data.players);

    roleScreen.classList.add("hidden");
    drawingScreen.classList.add("hidden");
    resultsScreen.classList.add("hidden");
    votingScreen.classList.remove("hidden");

    selectedVoteToken = null;
    hasVoted = false;
    hasSkippedVote = false;
    submitVoteBtn.disabled = true;
    submitVoteBtn.textContent = "VOTE FOR THIS PLAYER";
    if (nextRoundBtn) {
        nextRoundBtn.disabled = false;
        nextRoundBtn.textContent = "SKIP VOTE";
    }
    if (nextRoundStatus) {
        nextRoundStatus.textContent = "Skip vote = no decision. If most players skip, the same word continues.";
    }
    voteStatus.textContent = `0/${data.playerCount} votes · 0/${data.playerCount} skipped`;

    votingGuessPanel?.classList.toggle("hidden", myRole !== "imposter");
    if (votingGuessInput) votingGuessInput.value = "";
    if (votingGuessFeedback) votingGuessFeedback.textContent = "";
    if (votingGuessBtn) votingGuessBtn.disabled = false;

    playersGrid.innerHTML = "";

    data.players.forEach((player, index) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "vote-player-card";
        card.dataset.token = player.token;

        const number = document.createElement("span");
        number.className = "vote-number";
        number.textContent = String(index + 1).padStart(2, "0");

        const name = document.createElement("strong");
        name.textContent = player.name;

        const hint = document.createElement("span");
        hint.className = "vote-hint";
        hint.textContent = player.token === playerToken ? "YOU" : "SELECT PLAYER";

        card.append(number, name, hint);

        if (player.token === playerToken) {
            card.disabled = true;
            card.classList.add("self-vote");
            hint.textContent = "CANNOT VOTE YOURSELF";
        } else {
            card.addEventListener("click", () => {
                if (hasVoted) return;

                document.querySelectorAll(".vote-player-card").forEach(el => {
                    el.classList.remove("selected");
                });

                card.classList.add("selected");
                selectedVoteToken = player.token;
                submitVoteBtn.disabled = false;
                submitVoteBtn.textContent = `VOTE FOR ${player.name.toUpperCase()}`;
            });
        }

        playersGrid.appendChild(card);
    });
});

submitVoteBtn.addEventListener("click", () => {
    if (!selectedVoteToken || hasVoted || hasSkippedVote) return;

    hasVoted = true;
    submitVoteBtn.disabled = true;
    submitVoteBtn.textContent = "VOTE SUBMITTED ✓";

    document.querySelectorAll(".vote-player-card").forEach(card => {
        card.disabled = true;
    });

    socket.emit("submitVote", {
        roomCode,
        playerToken,
        targetToken: selectedVoteToken
    });
});

nextRoundBtn?.addEventListener("click", () => {
    if (!nextRoundBtn || nextRoundBtn.disabled || hasSkippedVote || hasVoted) return;

    hasSkippedVote = true;
    nextRoundBtn.disabled = true;
    nextRoundBtn.textContent = "VOTE SKIPPED ✓";
    submitVoteBtn.disabled = true;
    submitVoteBtn.textContent = "VOTE SKIPPED";
    document.querySelectorAll(".vote-player-card").forEach(card => {
        card.disabled = true;
    });

    if (nextRoundStatus) {
        nextRoundStatus.textContent = "You skipped. Other players can still vote or skip.";
    }

    socket.emit("nextRoundSameWord", { roomCode, playerToken });
});

socket.on("nextRoundWaiting", (data) => {
    if (!nextRoundBtn) return;

    const readyTokens = Array.isArray(data.readyTokens) ? data.readyTokens : [];
    const alreadySkipped = readyTokens.includes(playerToken) || hasSkippedVote;

    nextRoundBtn.disabled = alreadySkipped;
    nextRoundBtn.textContent = alreadySkipped ? "VOTE SKIPPED ✓" : "SKIP VOTE";

    if (nextRoundStatus) {
        nextRoundStatus.textContent = alreadySkipped
            ? `You skipped. Waiting: ${data.readyCount}/${data.playerCount} skipped`
            : `${data.readyCount}/${data.playerCount} players skipped. You can still vote or skip.`;
    }
});

socket.on("nextRoundStarted", (data) => {
    // Backward compatibility with older server builds.
    startRoleRevealForNextRound(data);
});

function startRoleRevealForNextRound(data = {}) {
    selectedVoteToken = null;
    hasVoted = false;
    hasSkippedVote = false;
    votingScreen.classList.add("hidden");
    resultsScreen.classList.add("hidden");
    drawingScreen.classList.add("hidden");
    roleScreen.classList.remove("hidden");

    readyBtn.disabled = false;
    readyBtn.textContent = "I'M READY";
    readyStatus.textContent = "Waiting for players...";

    if (nextRoundBtn) {
        nextRoundBtn.disabled = false;
        nextRoundBtn.textContent = "SKIP VOTE";
    }
    if (nextRoundStatus) {
        nextRoundStatus.textContent = "Skip vote = no decision. If most players skip, the same word continues.";
    }

    if (voteChatMessages) voteChatMessages.innerHTML = "";
    if (chatMessages) chatMessages.innerHTML = "";
    window.scrollTo({ top: 0, behavior: "smooth" });

    socket.emit("getGameData", { roomCode, playerToken });
}

socket.on("imposterCaughtContinue", (data) => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    drawingScreen.classList.add("hidden");
    votingScreen.classList.add("hidden");
    resultsScreen.classList.remove("hidden");
    resultsIcon.textContent = "✓";
    resultsIcon.classList.remove("danger");
    resultsIcon.classList.add("success");
    resultsTitle.textContent = `IMPOSTER ${data.caughtLabel || 1} CAUGHT`;
    resultsMessage.textContent = data.message || `Imposter ${data.caughtLabel || 1} was caught. Another imposter is still in the game.`;
    resultsPlayers.innerHTML = "";

    const notice = document.createElement("div");
    notice.className = "result-player-row actual-imposter";
    const left = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = data.caughtName || "Imposter";
    const role = document.createElement("span");
    role.textContent = `IMPOSTER ${data.caughtLabel || 1} — CAUGHT`;
    left.append(name, role);
    notice.appendChild(left);

    const remaining = document.createElement("b");
    remaining.className = "result-score";
    remaining.textContent = `IMPOSTER ${data.remainingLabel || 2} STILL IN`;
    notice.appendChild(remaining);
    resultsPlayers.appendChild(notice);

    playAgainBtn.disabled = true;
    playAgainBtn.textContent = "NEXT ROUND...";
});

socket.on("voteNoMajority", (data) => {
    if (nextRoundStatus) {
        nextRoundStatus.textContent = data.message || "No majority. The vote is inconclusive, so the same word continues.";
    }
    if (voteStatus) {
        voteStatus.textContent = "NO MAJORITY";
    }
});

socket.on("roundTransition", (data) => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    drawingScreen.classList.add("hidden");
    votingScreen.classList.add("hidden");
    resultsScreen.classList.remove("hidden");

    const isNoMajority = !data.eliminatedToken && /no majority|inconclusive/i.test(data.message || "");
    resultsIcon.textContent = data.eliminatedToken ? "✓" : (isNoMajority ? "=" : "→");
    resultsIcon.classList.toggle("success", Boolean(data.eliminatedToken));
    resultsIcon.classList.toggle("danger", false);
    resultsTitle.textContent = data.eliminatedToken
        ? "ROUND CONTINUES"
        : (isNoMajority ? "NO MAJORITY" : "VOTE SKIPPED");
    resultsMessage.textContent = data.message || (data.sameWord ? "The same word continues." : "A new word is coming.");
    resultsPlayers.innerHTML = "";
    playAgainBtn.disabled = true;
    playAgainBtn.textContent = "NEXT ROUND...";
});

socket.on("roundContinued", (data) => {
    startRoleRevealForNextRound(data);
});

socket.on("voteChoiceUpdate", (data) => {
    voteStatus.textContent = `${data.votedCount}/${data.playerCount} votes · ${data.skipCount}/${data.playerCount} skipped`;
    if (nextRoundStatus && data.skipMajority) {
        nextRoundStatus.textContent = "Most players skipped. Moving to the next round...";
    }
});

socket.on("voteUpdate", (data) => {
    voteStatus.textContent = `${data.votedCount}/${data.playerCount} votes`;
});

// =============================
// RESULTS
// =============================

socket.on("votingResults", (data) => {
    console.log("Voting results:", data);

    votingScreen.classList.add("hidden");
    resultsScreen.classList.remove("hidden");

    resultsIcon.textContent = data.playersWon ? "✓" : "!";
    resultsIcon.classList.toggle("success", data.playersWon);
    resultsIcon.classList.toggle("danger", !data.playersWon);

    resultsTitle.textContent = data.playersWon
        ? "Imposter caught!"
        : "The imposter escaped!";

    resultsMessage.textContent = data.playersWon
        ? `${data.caughtNames.join(" and ")} ${data.caughtNames.length === 1 ? "was" : "were"} identified correctly.`
        : `${data.caughtNames.join(" and ")} survived the vote.`;

    resultsPlayers.innerHTML = "";
    const myResult = data.players.find(player => player.token === playerToken);
    if (scoreNumber && myResult) scoreNumber.textContent = myResult.score || 0;

    data.players
        .sort((a, b) => b.votes - a.votes)
        .forEach(player => {
            const row = document.createElement("div");
            row.className = "result-player-row";
            if (player.imposter) row.classList.add("actual-imposter");

            const left = document.createElement("div");
            const name = document.createElement("strong");
            name.textContent = player.name;
            const role = document.createElement("span");
            role.textContent = player.imposter ? "IMPOSTER" : "PLAYER";
            left.append(name, role);

            const score = document.createElement("b");
            score.className = "result-score";
            score.textContent = `+${player.points || 0} XP · ${player.score || 0} TOTAL`;

            const voteLine = document.createElement("span");
            voteLine.className = "result-votes";
            voteLine.textContent = `${player.votes} ${player.votes === 1 ? "VOTE" : "VOTES"} · ${player.streak || 0} WIN STREAK`;
            left.append(voteLine);

            row.append(left, score);
            resultsPlayers.appendChild(row);
        });
});

playAgainBtn.addEventListener("click", () => {
    socket.emit("playAgain", { roomCode, playerToken });
    playAgainBtn.disabled = true;
    playAgainBtn.textContent = "READY ✓ · WAITING...";
});

homeBtn.addEventListener("click", () => {
    window.location.href = "/";
});

socket.on("playAgainWaiting", (data) => {
    const readyTokens = Array.isArray(data.readyTokens) ? data.readyTokens : [];
    const iAlreadyClicked = readyTokens.includes(playerToken);

    // Only the player who clicked PLAY AGAIN gets locked. Everyone else
    // must keep their button available so they can join the next round.
    playAgainBtn.disabled = iAlreadyClicked;
    playAgainBtn.textContent = iAlreadyClicked
        ? `READY ✓ · WAITING (${data.readyCount}/${data.playerCount})`
        : `PLAY AGAIN · ${data.readyCount}/${data.playerCount} READY`;
});

socket.on("playAgainStarted", () => {
    selectedVoteToken = null;
    hasVoted = false;
    resultsScreen.classList.add("hidden");
    votingScreen.classList.add("hidden");
    votingGuessPanel?.classList.add("hidden");
    drawingScreen.classList.add("hidden");
    roleScreen.classList.remove("hidden");
    readyBtn.disabled = false;
    readyBtn.textContent = "I'M READY";
    readyStatus.textContent = "Waiting for players...";
    chatMessages.innerHTML = "";
    voteChatMessages.innerHTML = "";
    playAgainBtn.disabled = false;
    playAgainBtn.textContent = "PLAY AGAIN";
    window.scrollTo({ top: 0, behavior: "smooth" });

    // The server has already created the new round. Ask for the new private role immediately.
    socket.emit("getGameData", { roomCode, playerToken });
});

// =============================
// ERROR
// =============================

function showGameToast(message, type = "info") {
    let toast = document.getElementById("gameToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "gameToast";
        toast.className = "game-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("show");
    clearTimeout(window.__inkToastTimer);
    window.__inkToastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

socket.on("gameError", (message) => {
    console.error("Game error:", message);
    showGameToast(message, "error");
});

socket.on("playerLeft", (data) => {
    showGameToast(`${data.playerName} left the room.`, "warning");
});

function openLeaveModal() { leaveModal?.classList.remove("hidden"); }
function closeLeaveModal() { leaveModal?.classList.add("hidden"); }

backBtn?.addEventListener("click", openLeaveModal);
cancelLeaveBtn?.addEventListener("click", closeLeaveModal);
leaveBackdrop?.addEventListener("click", closeLeaveModal);
confirmLeaveBtn?.addEventListener("click", () => {
    confirmLeaveBtn.disabled = true;
    socket.emit("leaveRoom", { roomCode, playerToken });
    window.location.href = "/";
});

