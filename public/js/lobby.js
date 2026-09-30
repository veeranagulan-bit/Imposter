const socket = io();

const roomCodeParams = new URLSearchParams(window.location.search);
const roomCode = roomCodeParams.get("room");

if (!roomCode) window.location.href = "/";

const playerToken = localStorage.getItem("imposterInkPlayerToken");
const playerName = localStorage.getItem("imposterInkPlayerName");

if (!playerToken || !playerName) window.location.href = "/";

document.getElementById("roomCode").textContent = roomCode;

socket.emit("joinRoom", { roomCode, playerName, playerToken });

socket.on("joinError", (message) => {
    alert(message);
    window.location.href = "/";
});

const playersList = document.getElementById("playersList");
const playerCountDisplay = document.getElementById("playerCount");
const startBtn = document.getElementById("startBtn");
const hostSettings = document.getElementById("hostSettings");
const guestSettings = document.getElementById("guestSettings");

let isHost = false;

socket.on("roomUpdated", ({ players, playerCount, gameMode }) => {
    playersList.innerHTML = "";
    playerCountDisplay.textContent = `${playerCount} / 8`;

    players.forEach(player => {
        const div = document.createElement("div");
        div.className = "player-row";
        
        const avatar = document.createElement("div");
        avatar.className = "player-avatar";
        avatar.textContent = player.name.charAt(0).toUpperCase();
        
        const nameNode = document.createElement("div");
        nameNode.className = "player-name";
        nameNode.textContent = player.name;
        
        div.appendChild(avatar);
        div.appendChild(nameNode);
        
        if (player.isHost) {
            const hostBadge = document.createElement("span");
            hostBadge.className = "host-badge";
            hostBadge.textContent = "HOST";
            div.appendChild(hostBadge);
            
            if (player.name === playerName) {
                isHost = true;
                hostSettings.style.display = "block";
                guestSettings.style.display = "none";
                startBtn.disabled = playerCount < 3;
            }
        }
        
        playersList.appendChild(div);
    });
    
    if (!isHost) {
        if (gameMode) {
            guestSettings.querySelector('.guest-mode-display').textContent = `Host selected: ${gameMode === 'similar_image' ? 'Similar Image Trap' : 'Hidden Image'}`;
        }
    }
});

// Broadcast game mode selection when changed by host
const modeRadios = document.querySelectorAll('input[name="gameMode"]');
modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (isHost) {
            // Can optionally broadcast to others, for now it will just be sent on start
        }
    });
});

startBtn.addEventListener("click", () => {
    if (isHost) {
        const mode = document.querySelector('input[name="gameMode"]:checked').value;
        socket.emit("startGame", { roomCode, gameMode: mode });
    }
});

socket.on("gameStarting", () => {
    window.location.href = `/game.html?room=${roomCode}`;
});

document.getElementById("copyBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(roomCode).then(() => {
        const toast = document.getElementById("toast");
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 3000);
    });
});