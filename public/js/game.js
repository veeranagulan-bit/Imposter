const socket = io();

const roomCodeParams = new URLSearchParams(window.location.search);
const roomCode = roomCodeParams.get("room");
const playerToken = localStorage.getItem("imposterInkPlayerToken");

if (!roomCode || !playerToken) {
    window.location.href = "/";
}

// Elements
const scoreNumber = document.getElementById("scoreNumber");
const roundNumber = document.getElementById("roundNumber");

const roleScreen = document.getElementById("roleScreen");
const roleLabel = document.getElementById("roleLabel");
const secretImageContainer = document.getElementById("secretImageContainer");
const secretImage = document.getElementById("secretImage");
const secretTopic = document.getElementById("secretTopic");
const secretHintContainer = document.getElementById("secretHintContainer");
const secretHint = document.getElementById("secretHint");
const readyBtn = document.getElementById("readyBtn");
const readyStatus = document.getElementById("readyStatus");

const clueSubmissionScreen = document.getElementById("clueSubmissionScreen");
const clueTimer = document.getElementById("clueTimer");
const clueInput = document.getElementById("clueInput");
const submitClueBtn = document.getElementById("submitClueBtn");
const clueFeedback = document.getElementById("clueFeedback");
const submissionCount = document.getElementById("submissionCount");

const clueRevealScreen = document.getElementById("clueRevealScreen");
const cluesGrid = document.getElementById("cluesGrid");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

const votingScreen = document.getElementById("votingScreen");
const voteStatus = document.getElementById("voteStatus");
const playersGrid = document.getElementById("playersGrid");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const voteChatMessages = document.getElementById("voteChatMessages");
const voteChatForm = document.getElementById("voteChatForm");
const voteChatInput = document.getElementById("voteChatInput");

const resultsScreen = document.getElementById("resultsScreen");
const resultsTitle = document.getElementById("resultsTitle");
const resultsMessage = document.getElementById("resultsMessage");
const resultsPlayers = document.getElementById("resultsPlayers");
const playAgainBtn = document.getElementById("playAgainBtn");
const resSecretImg = document.getElementById("resSecretImg");
const resSecretTopic = document.getElementById("resSecretTopic");
const resultsSecretImage = document.getElementById("resultsSecretImage");

let gameData = null;
let timerInterval = null;
let selectedVoteToken = null;

// Initialization
socket.emit("reconnectToRoom", { roomCode, playerToken });
setTimeout(() => {
    socket.emit("getGameData", { roomCode, playerToken });
}, 500);

socket.on("gameError", (msg) => {
    alert(msg);
    window.location.href = "/";
});

// Update UI based on Game State
socket.on("gameStarted", (data) => {
    gameData = data;
    roundNumber.textContent = data.round || 1;
    scoreNumber.textContent = data.score || 0;
    
    hideAllScreens();
    
    if (data.phase === "roleReveal") showRoleScreen();
    else if (data.phase === "clueSubmission") showClueSubmissionScreen(data);
    else if (data.phase === "clueReveal") showClueRevealScreen(data);
    else if (data.phase === "voting") showVotingScreen(data);
});

function hideAllScreens() {
    roleScreen.classList.add("hidden");
    clueSubmissionScreen.classList.add("hidden");
    clueRevealScreen.classList.add("hidden");
    votingScreen.classList.add("hidden");
    resultsScreen.classList.add("hidden");
}

function startTimer(endsAt, element) {
    if (timerInterval) clearInterval(timerInterval);
    if (!endsAt) {
        element.textContent = "--";
        return;
    }
    timerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        element.textContent = remaining;
        if (remaining <= 0) clearInterval(timerInterval);
    }, 500);
}

// Phase 1: Role
function showRoleScreen() {
    roleScreen.classList.remove("hidden");
    secretImageContainer.classList.add("hidden");
    secretHintContainer.classList.add("hidden");
    readyBtn.disabled = false;
    
    if (gameData.role === "imposter") {
        roleLabel.textContent = "YOU ARE THE IMPOSTER";
        if (gameData.hint) {
            secretHintContainer.classList.remove("hidden");
            secretHint.textContent = gameData.hint;
        } else if (gameData.image) {
            secretImageContainer.classList.remove("hidden");
            secretImage.src = gameData.image.url;
            secretTopic.textContent = gameData.image.topic;
            // It's a similar image trap
        }
    } else if (gameData.role === "player") {
        roleLabel.textContent = "YOUR SECRET TARGET";
        secretImageContainer.classList.remove("hidden");
        secretImage.src = gameData.image.url;
        secretTopic.textContent = gameData.image.topic;
    }
}

readyBtn.addEventListener("click", () => {
    readyBtn.disabled = true;
    socket.emit("playerReady", { roomCode, playerToken });
});
socket.on("readyUpdate", ({ readyCount, playerCount }) => {
    readyStatus.textContent = `${readyCount} / ${playerCount} Ready`;
});

// Phase 2: Clue Submission
socket.on("clueSubmissionStarted", (data) => {
    gameData.phase = "clueSubmission";
    gameData.turnEndsAt = data.turnEndsAt;
    showClueSubmissionScreen(gameData);
});

function showClueSubmissionScreen(data) {
    hideAllScreens();
    clueSubmissionScreen.classList.remove("hidden");
    startTimer(data.turnEndsAt, clueTimer);
    clueInput.value = "";
    clueInput.disabled = false;
    submitClueBtn.disabled = false;
    clueFeedback.textContent = "";
    
    if (data.submittedClue) {
        clueInput.value = data.submittedClue;
        clueInput.disabled = true;
        submitClueBtn.disabled = true;
        clueFeedback.textContent = "Clue submitted!";
    }
}

submitClueBtn.addEventListener("click", () => {
    const clue = clueInput.value.trim();
    if (!clue) return;
    socket.emit("submitClue", { roomCode, playerToken, clue });
    clueInput.disabled = true;
    submitClueBtn.disabled = true;
    clueFeedback.textContent = "Submitting...";
});
socket.on("clueRejected", (data) => {
    clueFeedback.textContent = data.message;
    clueInput.disabled = false;
    submitClueBtn.disabled = false;
});
socket.on("clueSubmissionUpdate", ({ submittedCount, totalCount }) => {
    submissionCount.textContent = `${submittedCount} / ${totalCount} Submitted`;
    if (clueInput.disabled && !clueFeedback.textContent.includes("rejected")) {
        clueFeedback.textContent = "Clue accepted! Waiting for others...";
    }
});

// Phase 3: Reveal & Chat
socket.on("clueRevealStarted", (data) => {
    hideAllScreens();
    clueRevealScreen.classList.remove("hidden");
    cluesGrid.innerHTML = "";
    
    data.clues.forEach(p => {
        const div = document.createElement("div");
        div.className = "clue-card";
        div.innerHTML = `<h4>${p.name}</h4><div class="the-clue">${p.clue}</div>`;
        cluesGrid.appendChild(div);
    });
    chatMessages.innerHTML = "";
});

chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;
    socket.emit("sendChat", { roomCode, playerToken, message: msg });
    chatInput.value = "";
});
voteChatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = voteChatInput.value.trim();
    if (!msg) return;
    socket.emit("sendChat", { roomCode, playerToken, message: msg });
    voteChatInput.value = "";
});

socket.on("chatMessage", ({ playerName, message }) => {
    const p = document.createElement("div");
    p.className = "chat-msg";
    p.innerHTML = `<strong>${playerName}</strong> ${message}`;
    chatMessages.appendChild(p);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Also append to vote chat if active
    const vp = document.createElement("div");
    vp.className = "chat-msg";
    vp.innerHTML = `<strong>${playerName}</strong> ${message}`;
    voteChatMessages.appendChild(vp);
    voteChatMessages.scrollTop = voteChatMessages.scrollHeight;
});
socket.on("chatRejected", ({ message }) => {
    const customAlert = document.getElementById("customAlert");
    const customAlertMessage = document.getElementById("customAlertMessage");
    const customAlertTitle = document.getElementById("customAlertTitle");
    const customAlertOkBtn = document.getElementById("customAlertOkBtn");
    
    customAlertTitle.textContent = "Cannot Send";
    customAlertMessage.textContent = message;
    customAlert.classList.remove("hidden");
    
    customAlertOkBtn.onclick = () => {
        customAlert.classList.add("hidden");
    };
});

// Phase 4: Voting
socket.on("votingStarted", (data) => {
    hideAllScreens();
    votingScreen.classList.remove("hidden");
    playersGrid.innerHTML = "";
    selectedVoteToken = null;
    submitVoteBtn.disabled = true;
    
    data.players.forEach(p => {
        if (p.token === playerToken) return; // Can't vote for self
        const div = document.createElement("div");
        div.className = "vote-card";
        div.innerHTML = `<div class="vote-avatar">${p.name.charAt(0).toUpperCase()}</div><h4>${p.name}</h4>`;
        div.onclick = () => {
            document.querySelectorAll(".vote-card").forEach(c => c.classList.remove("selected"));
            div.classList.add("selected");
            selectedVoteToken = p.token;
            submitVoteBtn.disabled = false;
        };
        playersGrid.appendChild(div);
    });
});
submitVoteBtn.addEventListener("click", () => {
    if (!selectedVoteToken) return;
    socket.emit("submitVote", { roomCode, playerToken, targetToken: selectedVoteToken });
    submitVoteBtn.disabled = true;
    nextRoundBtn.disabled = true;
    voteStatus.textContent = "Vote submitted.";
});
nextRoundBtn.addEventListener("click", () => {
    socket.emit("nextRoundSameWord", { roomCode, playerToken });
    submitVoteBtn.disabled = true;
    nextRoundBtn.disabled = true;
    voteStatus.textContent = "Skip voted.";
});
socket.on("voteChoiceUpdate", ({ votedCount, skipCount, playerCount }) => {
    voteStatus.textContent = `${votedCount + skipCount} / ${playerCount} voted`;
});
socket.on("roundTransition", (data) => {
    // Show custom alert instead of native alert
    const customAlert = document.getElementById("customAlert");
    const customAlertMessage = document.getElementById("customAlertMessage");
    const customAlertTitle = document.getElementById("customAlertTitle");
    const customAlertOkBtn = document.getElementById("customAlertOkBtn");
    
    customAlertTitle.textContent = "Round Update";
    customAlertMessage.textContent = data.message;
    customAlert.classList.remove("hidden");
    
    customAlertOkBtn.onclick = () => {
        customAlert.classList.add("hidden");
    };
});
socket.on("roundContinued", (data) => {
    // Reset for next round
    socket.emit("getGameData", { roomCode, playerToken });
});

// Phase 5: Results
socket.on("votingResults", (data) => {
    hideAllScreens();
    resultsScreen.classList.remove("hidden");
    resultsTitle.textContent = data.playersWon ? "Imposter Caught!" : "Imposter Won!";
    resultsMessage.textContent = data.caughtNames ? `We caught ${data.caughtNames.join(", ")}!` : "The imposter survived.";
    
    resultsPlayers.innerHTML = "";
    data.players.forEach(p => {
        const div = document.createElement("div");
        div.className = `result-player-row ${p.imposter ? "is-imposter" : ""}`;
        div.innerHTML = `<span class="name">${p.name} ${p.imposter ? "(Imposter)" : ""}</span>
                         <span class="role">Votes received: ${p.votes}</span>
                         <span class="points">Score: ${p.score}</span>`;
        resultsPlayers.appendChild(div);
    });
    
    if (data.secretImage) {
        resultsSecretImage.classList.remove("hidden");
        resSecretImg.src = data.secretImage.url;
        resSecretTopic.textContent = data.secretImage.topic;
    }
});

playAgainBtn.addEventListener("click", () => {
    socket.emit("playAgain", { roomCode, playerToken });
    playAgainBtn.textContent = "WAITING...";
    playAgainBtn.disabled = true;
});
socket.on("playAgainStarted", () => {
    playAgainBtn.textContent = "PLAY AGAIN";
    playAgainBtn.disabled = false;
    socket.emit("getGameData", { roomCode, playerToken });
});
