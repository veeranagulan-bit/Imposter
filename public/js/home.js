const socket = io();

const createBtn =
    document.getElementById("createBtn");

const joinBtn =
    document.getElementById("joinBtn");

const roomCodeInput =
    document.getElementById("roomCode");

const errorMessage =
    document.getElementById("errorMessage");

const homeRulesBtn = document.getElementById("homeRulesBtn");
const homeRulesModal = document.getElementById("homeRulesModal");
const homeRulesClose = document.getElementById("homeRulesClose");
const homeRulesBackdrop = document.getElementById("homeRulesBackdrop");
const rulesReadCheck = document.getElementById("rulesReadCheck");
const rulesContinueBtn = document.getElementById("rulesContinueBtn");
let pendingActionAfterRules = null;


// =============================
// PLAYER ID
// =============================

let playerToken =
    localStorage.getItem("imposterInkPlayerToken");

if (!playerToken) {

    playerToken =
        crypto.randomUUID();

    localStorage.setItem(
        "imposterInkPlayerToken",
        playerToken
    );

}


// =============================
// MODAL
// =============================

const nameModal =
    document.getElementById("nameModal");

const closeModal =
    document.getElementById("closeModal");

const modalLabel =
    document.getElementById("modalLabel");

const playerNameInput =
    document.getElementById("playerName");

const modalError =
    document.getElementById("modalError");

const confirmName =
    document.getElementById("confirmName");


let action = null;
let selectedRoomCode = null;


function openHomeRules() {
    homeRulesModal.classList.add("active");
    rulesReadCheck.checked = false;
    rulesContinueBtn.disabled = true;
}

function closeHomeRules() {
    homeRulesModal.classList.remove("active");
    pendingActionAfterRules = null;
}

function requireRulesThenOpenNameModal() {
    if (sessionStorage.getItem("imposterInkRulesRead") === "yes") {
        nameModal.classList.add("active");
        setTimeout(() => playerNameInput.focus(), 200);
        return;
    }
    pendingActionAfterRules = action;
    openHomeRules();
}

homeRulesBtn?.addEventListener("click", openHomeRules);
homeRulesClose?.addEventListener("click", closeHomeRules);
homeRulesBackdrop?.addEventListener("click", closeHomeRules);
rulesReadCheck?.addEventListener("change", () => {
    rulesContinueBtn.disabled = !rulesReadCheck.checked;
});
rulesContinueBtn?.addEventListener("click", () => {
    if (!rulesReadCheck.checked) return;
    sessionStorage.setItem("imposterInkRulesRead", "yes");
    const nextAction = pendingActionAfterRules;
    closeHomeRules();
    if (nextAction) {
        nameModal.classList.add("active");
        setTimeout(() => playerNameInput.focus(), 200);
    }
});

// =============================
// CREATE ROOM
// =============================

createBtn.addEventListener("click", () => {

    action = "create";

    modalLabel.textContent =
        "CREATE ROOM";

    playerNameInput.value = "";
    modalError.textContent = "";

    requireRulesThenOpenNameModal();

});


// =============================
// JOIN ROOM
// =============================

joinBtn.addEventListener("click", () => {

    const roomCode =
        roomCodeInput.value
            .trim()
            .toUpperCase();

    if (roomCode.length !== 6) {

        showError(
            "Enter a valid 6-character room code."
        );

        return;
    }

    selectedRoomCode = roomCode;
    action = "join";

    modalLabel.textContent =
        "JOIN ROOM";

    playerNameInput.value = "";
    modalError.textContent = "";

    requireRulesThenOpenNameModal();

});


// =============================
// CONFIRM
// =============================

confirmName.addEventListener("click", () => {

    const playerName =
        playerNameInput.value.trim();

    if (!playerName) {

        modalError.textContent =
            "Please enter a player name.";

        return;
    }

    if (playerName.length < 2) {

        modalError.textContent =
            "Name must be at least 2 characters.";

        return;
    }


    localStorage.setItem(
        "imposterInkPlayerName",
        playerName
    );


    if (action === "create") {

        socket.emit("createRoom", {

            playerName,

            playerToken

        });

    }


    if (action === "join") {

        socket.emit("joinRoom", {

            roomCode: selectedRoomCode,

            playerName,

            playerToken

        });

    }

});


// =============================
// ENTER KEY
// =============================

playerNameInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {
            confirmName.click();
        }

    }
);


// =============================
// CLOSE
// =============================

closeModal.addEventListener(
    "click",
    closeModalWindow
);


nameModal.addEventListener(
    "click",
    (event) => {

        if (event.target === nameModal) {
            closeModalWindow();
        }

    }
);


function closeModalWindow() {

    nameModal.classList.remove("active");

    playerNameInput.value = "";
    modalError.textContent = "";

}


// =============================
// ROOM CREATED
// =============================

socket.on(
    "roomCreated",
    ({ roomCode }) => {

        window.location.href =
            `/lobby.html?room=${roomCode}`;

    }
);


// =============================
// ROOM JOINED
// =============================

socket.on(
    "joinedRoom",
    ({ roomCode }) => {

        window.location.href =
            `/lobby.html?room=${roomCode}`;

    }
);


// =============================
// ERROR
// =============================

socket.on(
    "joinError",
    (message) => {

        modalError.textContent =
            message;

    }
);


function showError(message) {

    errorMessage.textContent =
        message;

}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeHomeRules();
        closeModalWindow();
    }
});
