const socket = io();

const params =
    new URLSearchParams(
        window.location.search
    );

const roomCode =
    params.get("room");


const playerToken =
    localStorage.getItem(
        "imposterInkPlayerToken"
    );


const playerName =
    localStorage.getItem(
        "imposterInkPlayerName"
    );


const roomCodeElement =
    document.getElementById("roomCode");

const playersList =
    document.getElementById("playersList");

const playerCount =
    document.getElementById("playerCount");

const startBtn =
    document.getElementById("startBtn");

const copyBtn =
    document.getElementById("copyBtn");

const leaveBtn =
    document.getElementById("leaveBtn");

const toast =
    document.getElementById("toast");

const backHomeBtn = document.getElementById("backHomeBtn");
const lobbyLeaveModal = document.getElementById("lobbyLeaveModal");
const lobbyLeaveBackdrop = document.getElementById("lobbyLeaveBackdrop");
const cancelLobbyLeave = document.getElementById("cancelLobbyLeave");
const confirmLobbyLeave = document.getElementById("confirmLobbyLeave");


roomCodeElement.textContent =
    roomCode || "ERROR";


console.log("Lobby room:", roomCode);
console.log("Player:", playerName);


// =============================
// RECONNECT
// =============================

socket.emit("reconnectToRoom", {

    roomCode,

    playerToken

});


// =============================
// ROOM UPDATE
// =============================

socket.on("roomUpdated", (data) => {

    playersList.innerHTML = "";

    playerCount.textContent =
        `${data.playerCount} / 8`;


    let currentPlayerIsHost = false;


    data.players.forEach((player) => {

        const playerElement =
            document.createElement("div");

        playerElement.className =
            "player";


        const avatar =
            document.createElement("div");

        avatar.className =
            "player-avatar";

        avatar.textContent =
            player.name
                .charAt(0)
                .toUpperCase();


        const name =
            document.createElement("div");

        name.className =
            "player-name";

        name.textContent =
            player.name;


        playerElement.appendChild(avatar);

        playerElement.appendChild(name);


        if (player.isHost) {

            const badge =
                document.createElement("div");

            badge.className =
                "host-badge";

            badge.textContent =
                "HOST";

            playerElement.appendChild(badge);


            if (
                player.name === playerName
            ) {

                currentPlayerIsHost = true;

            }

        }


        playersList.appendChild(
            playerElement
        );

    });


    startBtn.disabled =
        !currentPlayerIsHost ||
        data.playerCount < 3;


    console.log(
        "Host:",
        currentPlayerIsHost,
        "Players:",
        data.playerCount
    );

});


// =============================
// START GAME
// =============================

startBtn.addEventListener("click", () => {

    console.log("START GAME clicked");

    if (startBtn.disabled) {

        console.log(
            "Start button is disabled"
        );

        return;
    }


    startBtn.disabled = true;

    startBtn.textContent =
        "STARTING GAME...";


    socket.emit(
        "startGame",
        {
            roomCode
        }
    );

});


// =============================
// GAME STARTING
// =============================

socket.on("gameStarting", () => {

    console.log(
        "Game starting..."
    );


    window.location.href =
        `/game.html?room=${roomCode}`;

});


// =============================
// GAME ERROR
// =============================

socket.on("gameError", (message) => {

    console.error(
        "GAME ERROR:",
        message
    );


    startBtn.disabled = false;

    startBtn.textContent =
        "START GAME";

    showLobbyToast(message, "error");

});


// =============================
// COPY ROOM
// =============================

copyBtn.addEventListener(
    "click",
    async () => {

        if (!roomCode) {
            return;
        }

        await navigator.clipboard
            .writeText(roomCode);

        toast.classList.add("show");

        setTimeout(() => {

            toast.classList.remove("show");

        }, 1800);

    }
);


// =============================
// LEAVE
// =============================

function openLobbyLeaveModal() { lobbyLeaveModal?.classList.remove("hidden"); }
function closeLobbyLeaveModal() { lobbyLeaveModal?.classList.add("hidden"); }

backHomeBtn?.addEventListener("click", openLobbyLeaveModal);
leaveBtn?.addEventListener("click", openLobbyLeaveModal);
cancelLobbyLeave?.addEventListener("click", closeLobbyLeaveModal);
lobbyLeaveBackdrop?.addEventListener("click", closeLobbyLeaveModal);
confirmLobbyLeave?.addEventListener("click", () => {
    confirmLobbyLeave.disabled = true;
    socket.emit("leaveRoom", { roomCode, playerToken });
    window.location.href = "/";
});

socket.on("playerLeft", (data) => {
    showLobbyToast(`${data.playerName} left the room.`, "warning");
});

function showLobbyToast(message, type = "info") {
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("show");
    clearTimeout(window.__lobbyToastTimer);
    window.__lobbyToastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLobbyLeaveModal();
});