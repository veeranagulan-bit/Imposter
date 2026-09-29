const express = require("express");
const crypto = require("crypto");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

// =============================
// WORD BANK
// =============================

const wordBank = [
    "BALL",
    "UMBRELLA",
    "ROCKET",
    "BICYCLE",
    "PIZZA",
    "GUITAR",
    "CAMERA",
    "CASTLE",
    "AIRPLANE",
    "SUNGLASSES",
    "BACKPACK",
    "ICE CREAM",
    "TELEVISION",
    "ROBOT",
    "CLOCK",
    "LAMP",
    "SHOE",
    "BRIDGE",
    "TRAIN",
    "KITE"
];


// Relevant clue sets for imposters.
// Clues are intentionally vague enough to avoid giving away the exact word.
const clueBank = {
    "BALL": [
        "You can throw, catch, or kick it.",
        "It is commonly used during games and sports.",
        "It is usually round and can move quickly."
    ],
    "UMBRELLA": [
        "You might carry it when the weather turns wet.",
        "It helps protect you from something falling from the sky.",
        "You can open it above your head when needed."
    ],
    "ROCKET": [
        "It is associated with space travel.",
        "It can launch far beyond the ground.",
        "It is built to travel at very high speed."
    ],
    "BICYCLE": [
        "You can ride it without using a motor.",
        "It is a common way to travel short distances.",
        "You move it mainly by using your legs."
    ],
    "PIZZA": [
        "It is a popular food often shared with others.",
        "It is usually served in slices.",
        "It can have many different toppings."
    ],
    "GUITAR": [
        "It is played by strumming or picking.",
        "It is a popular musical instrument.",
        "It usually has strings and a long neck."
    ],
    "CAMERA": [
        "It is used to capture moments.",
        "You can use it to create photos or videos.",
        "It is often pointed at something you want to remember."
    ],
    "CASTLE": [
        "It is often associated with kings and queens.",
        "It can have towers and strong walls.",
        "You might see one in a fairy tale."
    ],
    "AIRPLANE": [
        "It can carry people high above the ground.",
        "It is commonly used for long-distance travel.",
        "It takes off and lands at special places."
    ],
    "SUNGLASSES": [
        "People often wear them outdoors on bright days.",
        "They are worn in front of your eyes.",
        "They can make bright light more comfortable to look at."
    ],
    "BACKPACK": [
        "You can carry your belongings in it.",
        "Students often use one every day.",
        "It is designed to be carried on your back."
    ],
    "ICE CREAM": [
        "It is a cold dessert.",
        "It can come in many flavors.",
        "It usually melts if left somewhere warm."
    ],
    "TELEVISION": [
        "People use it to watch shows and movies.",
        "It is commonly found in living rooms.",
        "It displays moving pictures and sound."
    ],
    "ROBOT": [
        "It is a machine that can perform tasks.",
        "It can be controlled or programmed to do things.",
        "It is often shown as a character in science fiction."
    ],
    "CLOCK": [
        "It helps you know when something should happen.",
        "It is used to keep track of time.",
        "You can find one on a wall, desk, or wrist."
    ],
    "LAMP": [
        "It helps make a dark place brighter.",
        "You can find one on a desk or beside a bed.",
        "You usually turn it on when you need more light."
    ],
    "SHOE": [
        "People usually wear a pair of them.",
        "They protect your feet while you walk.",
        "They come in many styles for different activities."
    ],
    "BRIDGE": [
        "It helps people or vehicles cross something.",
        "It connects two sides of a place.",
        "You can find one over water or roads."
    ],
    "TRAIN": [
        "It carries passengers or goods along a fixed route.",
        "It is made of connected cars or coaches.",
        "It usually travels on tracks."
    ],
    "KITE": [
        "People often use it outdoors on windy days.",
        "It can fly while being controlled from the ground.",
        "It is usually attached to a long string."
    ]
};

function getActivePlayers(room) {
    if (!room) return [];
    const eliminated = room.game?.eliminatedTokens || new Set();
    return room.players.filter(player => !eliminated.has(player.token));
}

function ensureScoreboard(room) {
    if (!room.scores) room.scores = {};
    if (!room.streaks) room.streaks = {};
    room.players.forEach(player => {
        if (room.scores[player.token] === undefined) room.scores[player.token] = 0;
        if (room.streaks[player.token] === undefined) room.streaks[player.token] = 0;
    });
}

function applyRoundScores(room, game, winner, reason = "vote") {
    ensureScoreboard(room);

    const roundPoints = {};
    room.players.forEach(player => {
        roundPoints[player.token] = 10; // participation
    });

    const correctVoters = new Set();
    Object.entries(game.votes || {}).forEach(([voterToken, targetToken]) => {
        if (game.imposterTokens.includes(targetToken)) correctVoters.add(voterToken);
    });

    room.players.forEach(player => {
        const isImposter = game.imposterTokens.includes(player.token);
        const won = winner === "imposter" ? isImposter : !isImposter;

        if (won) {
            if (winner === "imposter" && reason === "wordGuess") {
                // 10 participation + 100 imposter win + 100 correct-guess bonus = 210 XP
                roundPoints[player.token] += 100;
                if (player.token === game.guesserToken) {
                    roundPoints[player.token] += 100;
                }
            } else {
                roundPoints[player.token] += winner === "imposter" ? 150 : 100;
            }
            room.streaks[player.token] = (room.streaks[player.token] || 0) + 1;
        } else {
            room.streaks[player.token] = 0;
        }

        if (winner === "players" && correctVoters.has(player.token)) {
            roundPoints[player.token] += 50;
        }

        room.scores[player.token] += roundPoints[player.token];
    });

    return roundPoints;
}

function buildResultPlayers(room, game, roundPoints = {}) {
    ensureScoreboard(room);
    return room.players.map(player => ({
        token: player.token,
        name: player.name,
        votes: (game.votes && game.votes[player.token]) ? 0 : 0,
        imposter: game.imposterTokens.includes(player.token),
        points: roundPoints[player.token] || 0,
        score: room.scores[player.token] || 0,
        streak: room.streaks[player.token] || 0
    }));
}

function randomIndex(length) {
    return crypto.randomInt(0, length);
}

function shuffleArray(items) {
    const array = [...items];

    for (let i = array.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

function getImposterClue(secretWord, usedClues = new Set()) {
    const clues = clueBank[secretWord] || [
        "Think about something familiar from everyday life.",
        "You may see or use it in a familiar situation.",
        "It is something people can recognize in different places."
    ];

    const available = clues.filter(clue => !usedClues.has(clue));
    const pool = available.length ? available : clues;
    return pool[randomIndex(pool.length)];
}



io.on("connection", (socket) => {

    console.log("Player connected:", socket.id);


    // =============================
    // CREATE ROOM
    // =============================

    socket.on("createRoom", ({ playerName, playerToken }) => {

        const roomCode = generateRoomCode();

        rooms[roomCode] = {
            hostToken: playerToken,
            players: []
        };

        rooms[roomCode].players.push({
            id: socket.id,
            token: playerToken,
            name: playerName
        });

        socket.join(roomCode);

        socket.emit("roomCreated", {
            roomCode
        });

        updateRoom(roomCode);

        console.log(
            `${playerName} created room ${roomCode}`
        );

    });


    // =============================
    // JOIN ROOM
    // =============================

    socket.on("joinRoom", ({ roomCode, playerName, playerToken }) => {

    roomCode = roomCode.toUpperCase();

    const room = rooms[roomCode];

    if (!room) {

        socket.emit(
            "joinError",
            "Room does not exist."
        );

        return;
    }


    if (room.players.length >= 8) {

        socket.emit(
            "joinError",
            "Room is full."
        );

        return;
    }


    // =============================
    // RECONNECTING PLAYER
    // =============================

    const existingPlayer =
        room.players.find(
            player =>
                player.token === playerToken
        );

    if (existingPlayer) {

        existingPlayer.id = socket.id;
        existingPlayer.name = playerName.trim();

    } else {

        // =============================
        // CHECK DUPLICATE NAME
        // =============================

        const cleanName =
            playerName.trim();

        const nameTaken =
            room.players.some(
                player =>
                    player.name.trim().toLowerCase() ===
                    cleanName.toLowerCase()
            );

        if (nameTaken) {

            socket.emit(
                "joinError",
                "That player name is already taken in this room."
            );

            return;
        }


        // =============================
        // ADD PLAYER
        // =============================

        room.players.push({

            id: socket.id,

            token: playerToken,

            name: cleanName

        });

    }


    socket.join(roomCode);

    socket.emit("joinedRoom", {
        roomCode
    });

    updateRoom(roomCode);

    console.log(
        `${playerName} joined room ${roomCode}`
    );

});


    // =============================
    // RECONNECT TO LOBBY
    // =============================

    socket.on("reconnectToRoom", ({ roomCode, playerToken }) => {

        const room = rooms[roomCode];

        if (!room) {
            return;
        }

        const player =
            room.players.find(
                player => player.token === playerToken
            );

        if (!player) {
            return;
        }

        player.id = socket.id;

        socket.join(roomCode);

        socket.emit("reconnected", {
            roomCode
        });

        updateRoom(roomCode);

        console.log(
            `${player.name} reconnected to ${roomCode}`
        );

    });


// =============================
// START GAME
// =============================

socket.on("startGame", ({ roomCode }) => {

    const room = rooms[roomCode];

    if (!room) {
        socket.emit("gameError", "Room does not exist.");
        return;
    }

    // Only host can start
    const host = room.players.find(
        player => player.token === room.hostToken
    );

    if (!host || host.id !== socket.id) {

        socket.emit(
            "gameError",
            "Only the host can start the game."
        );

        return;
    }

    // Minimum players
    if (room.players.length < 3) {

        socket.emit(
            "gameError",
            "At least 3 players are required."
        );

        return;
    }

    // Prevent starting twice
    if (room.game && room.game.active) {

        socket.emit(
            "gameError",
            "Game has already started."
        );

        return;
    }


    // =============================
    // RANDOM WORD
    // =============================

    const secretWord =
        wordBank[randomIndex(wordBank.length)];


    // =============================
    // IMPOSTER COUNT
    // =============================

    const imposterCount =
        room.players.length >= 6 ? 2 : 1;


    // =============================
    // SHUFFLE
    // =============================

    const shuffled = shuffleArray(room.players);


    const imposters =
        shuffled.slice(0, imposterCount);


    const imposterTokens =
        imposters.map(
            player => player.token
        );


    // =============================
    // CREATE GAME
    // =============================

    ensureScoreboard(room);

    room.game = {
    active: true,

    secretWord,

    imposterTokens,

    imposterLabels: Object.fromEntries(imposterTokens.map((token, index) => [token, index + 1])),

    eliminatedTokens: new Set(),

    playerData: {},

    round: 1,

    // ROLE REVEAL → DRAWING
    phase: "roleReveal",

    // Players who clicked I'M READY
    readyPlayers: new Set(),

    // Turn order
    turnOrder: room.players.map(player => player.token),

    // Current drawing player
    currentTurnIndex: 0,

    // 30 second turn
    turnDuration: 30000,

    turnEndsAt: null,

    turnTimer: null
};


    // =============================
    // CREATE PRIVATE PLAYER DATA
    // =============================

    const usedClues = new Set();

    room.players.forEach((player) => {

        const isImposter =
            imposterTokens.includes(player.token);


        if (isImposter) {

            const clue = getImposterClue(secretWord, usedClues);
            usedClues.add(clue);

            room.game.playerData[player.token] = {

                role: "imposter",

                clue,

                round: 1

            };

        } else {

            room.game.playerData[player.token] = {

                role: "player",

                word: secretWord,

                round: 1

            };

        }

    });


    console.log(
        `🎮 Game started in room ${roomCode}`
    );

    console.log(
        `Word: ${secretWord}`
    );

    console.log(
        `Imposters: ${
            imposters
                .map(player => player.name)
                .join(", ")
        }`
    );


    // =============================
    // TELL CLIENTS TO OPEN GAME
    // =============================

    io.to(roomCode).emit(
        "gameStarting"
    );

});

// =============================
// GET PRIVATE GAME DATA
// =============================

socket.on("getGameData", ({ roomCode, playerToken }) => {

    const room = rooms[roomCode];

    if (!room || !room.game || !room.game.active) {

        socket.emit(
            "gameError",
            "Game is not active."
        );

        return;
    }


    const player =
        room.players.find(
            p => p.token === playerToken
        );


    if (!player) {

        socket.emit(
            "gameError",
            "Player not found."
        );

        return;
    }


    // Update socket ID after moving
    // from lobby to game page

    player.id = socket.id;

    socket.join(roomCode);


    const privateData =
        room.game.playerData[playerToken];


    if (!privateData) {

        socket.emit(
            "gameError",
            "Game data not found."
        );

        return;
    }


    socket.emit(
    "gameStarted",
    {
        ...privateData,

        phase:
            room.game.phase,

        readyCount:
            room.game.readyPlayers.size,

        playerCount:
            getActivePlayers(room).length,

        currentPlayerToken:
            room.game.turnOrder[
                room.game.currentTurnIndex
            ],

        turnEndsAt:
            room.game.turnEndsAt,

        score:
            room.scores && room.scores[playerToken] !== undefined
                ? room.scores[playerToken]
                : 0
    }
);

});


// =============================
// PLAYER READY
// =============================

socket.on("playerReady", ({ roomCode, playerToken }) => {

    const room = rooms[roomCode];

    if (!room || !room.game || !room.game.active) {
        socket.emit("gameError", "Game is not active.");
        return;
    }

    const player =
        room.players.find(
            p => p.token === playerToken
        );

    if (!player) {
        socket.emit("gameError", "Player not found.");
        return;
    }

    if (room.game.eliminatedTokens?.has(playerToken)) {
        socket.emit("gameError", "You have been eliminated from this match.");
        return;
    }

    // Mark player as ready
    room.game.readyPlayers.add(playerToken);

    console.log(
        `${player.name} is READY in room ${roomCode}`
    );

    const readyCount =
        room.game.readyPlayers.size;

    const playerCount =
        getActivePlayers(room).length;

    // Tell everyone
    io.to(roomCode).emit(
        "readyUpdate",
        {
            readyCount,
            playerCount
        }
    );

    // Everyone ready
    if (readyCount === playerCount) {

        console.log(
            `🔥 Everyone ready in room ${roomCode}`
        );

        startDrawingTurn(roomCode);
    }
});


// =============================
// LIVE CHAT
// =============================

socket.on("sendChat", ({ roomCode, playerToken, message }) => {
    const room = rooms[roomCode];
    const game = room && room.game;
    if (!room || !game || !game.active || !["drawing", "voting"].includes(game.phase)) return;

    const player = room.players.find(p => p.token === playerToken);
    if (!player) return;

    const cleanMessage = String(message || "").trim().slice(0, 160);
    if (!cleanMessage) return;

    // Never allow the secret word to be revealed in room chat.
    // Compare a compact form so punctuation/spaces cannot be used to bypass it.
    const compact = value => String(value)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    const secret = compact(game.secretWord);
    const chatText = compact(cleanMessage);

    if (secret && secret.length >= 3 && chatText.includes(secret)) {
        socket.emit("chatRejected", {
            message: "You can't reveal the secret word in chat. Try describing the drawing instead."
        });
        return;
    }

    io.to(roomCode).emit("chatMessage", {
        playerToken,
        playerName: player.name,
        message: cleanMessage,
        sentAt: Date.now()
    });
});

// =============================
// IMPOSTER GUESS
// =============================

socket.on("guessWord", ({ roomCode, playerToken, guess }) => {
    const room = rooms[roomCode];
    const game = room && room.game;
    if (!room || !game || !game.active || !["drawing", "voting"].includes(game.phase)) return;

    if (!game.imposterTokens.includes(playerToken)) return;

    const cleanGuess = String(guess || "").trim().replace(/\s+/g, " ");
    if (!cleanGuess || cleanGuess.length > 50) return;

    const normalize = value => String(value).trim().replace(/\s+/g, " ").toLowerCase();
    const correct = normalize(cleanGuess) === normalize(game.secretWord);

    if (correct) {
        game.phase = "results";
        game.active = false;

        if (game.turnTimer) {
            clearTimeout(game.turnTimer);
            game.turnTimer = null;
        }

        ensureScoreboard(room);
        const roundPoints = {};
        room.players.forEach(player => {
            const isImposter = game.imposterTokens.includes(player.token);
            roundPoints[player.token] = isImposter ? 210 : 0;
            room.scores[player.token] += roundPoints[player.token];
            room.streaks[player.token] = isImposter
                ? (room.streaks[player.token] || 0) + 1
                : 0;
        });

        const guesser = room.players.find(p => p.token === playerToken);
        const players = room.players.map(player => ({
            token: player.token,
            name: player.name,
            votes: 0,
            imposter: game.imposterTokens.includes(player.token),
            points: roundPoints[player.token] || 0,
            score: room.scores[player.token] || 0,
            streak: room.streaks[player.token] || 0
        }));

        io.to(roomCode).emit("imposterGuessedWord", {
            winner: "imposter",
            guesserName: guesser ? guesser.name : "The Imposter",
            word: game.secretWord,
            players
        });

        console.log(`🎯 ${guesser ? guesser.name : "Imposter"} guessed the word in ${roomCode}`);
    } else {
        socket.emit("guessResult", {
            correct: false,
            message: "Not quite. Try again!"
        });
    }
});

// =============================
// DRAW START
// =============================

socket.on(
    "drawStart",
    (data) => {

        const room =
            rooms[data.roomCode];

        if (
            !room ||
            !room.game ||
            !room.game.active
        ) {
            return;
        }

        const currentToken =
            room.game.turnOrder[
                room.game.currentTurnIndex
            ];

        // Only current player can draw
        if (
            data.playerToken !==
            currentToken
        ) {
            return;
        }

        socket.to(
            data.roomCode
        ).emit(
            "drawStart",
            data
        );
    }
);


// =============================
// DRAW MOVE
// =============================

socket.on(
    "drawMove",
    (data) => {

        const room =
            rooms[data.roomCode];

        if (
            !room ||
            !room.game ||
            !room.game.active
        ) {
            return;
        }

        const currentToken =
            room.game.turnOrder[
                room.game.currentTurnIndex
            ];

        if (
            data.playerToken !==
            currentToken
        ) {
            return;
        }

        socket.to(
            data.roomCode
        ).emit(
            "drawMove",
            data
        );
    }
);


// =============================
// CLEAR CANVAS
// =============================

socket.on(
    "clearCanvas",
    (data) => {

        const room =
            rooms[data.roomCode];

        if (
            !room ||
            !room.game ||
            !room.game.active
        ) {
            return;
        }

        const currentToken =
            room.game.turnOrder[
                room.game.currentTurnIndex
            ];

        if (
            data.playerToken !==
            currentToken
        ) {
            return;
        }

        socket.to(
            data.roomCode
        ).emit(
            "clearCanvas",
            data
        );
    }
);


// =============================
// START DRAWING TURN
// =============================

function startDrawingTurn(roomCode) {

    const room = rooms[roomCode];

    if (!room || !room.game || !room.game.active) {
        return;
    }

    const game = room.game;

    // Clear previous timer
    if (game.turnTimer) {
        clearTimeout(game.turnTimer);
        game.turnTimer = null;
    }

    // No more players
    if (
        game.currentTurnIndex >=
        game.turnOrder.length
    ) {

        finishDrawingPhase(roomCode);

        return;
    }

    game.phase = "drawing";

    const currentPlayerToken =
        game.turnOrder[
            game.currentTurnIndex
        ];

    const currentPlayer =
        room.players.find(
            player =>
                player.token ===
                currentPlayerToken
        );

    if (!currentPlayer) {

        game.currentTurnIndex++;

        startDrawingTurn(roomCode);

        return;
    }

    // Server-authoritative end time
    const activeTurnDuration = game.turnDuration;

    game.turnEndsAt =
        Date.now() + activeTurnDuration;

    console.log(
        `🎨 ${currentPlayer.name} is drawing in ${roomCode}`
    );

    // Tell every player
    io.to(roomCode).emit(
        "drawingTurnStarted",
        {
            currentPlayerToken,
            currentPlayerName:
                currentPlayer.name,

            turnEndsAt:
                game.turnEndsAt,

            duration:
                game.turnDuration,

            turnNumber:
                game.currentTurnIndex + 1,

            totalTurns:
                game.turnOrder.length
        }
    );

    // Automatically end after 30 seconds
    game.turnTimer =
        setTimeout(() => {

            nextDrawingTurn(roomCode);

        }, activeTurnDuration);
}

// =============================
// NEXT DRAWING TURN
// =============================

function nextDrawingTurn(roomCode) {

    const room = rooms[roomCode];

    if (!room || !room.game || !room.game.active) {
        return;
    }

    const game = room.game;

    if (game.turnTimer) {

        clearTimeout(game.turnTimer);

        game.turnTimer = null;
    }

    game.currentTurnIndex++;

    startDrawingTurn(roomCode);
}

// =============================
// DRAWING PHASE COMPLETE
// =============================

function finishDrawingPhase(roomCode) {

    const room = rooms[roomCode];

    if (!room || !room.game) {
        return;
    }

    const game = room.game;

    game.phase = "voting";

    game.turnEndsAt = null;

    if (game.turnTimer) {

        clearTimeout(game.turnTimer);

        game.turnTimer = null;
    }

    console.log(
        `🗳️ Drawing finished in room ${roomCode}`
    );

    io.to(roomCode).emit(
        "drawingPhaseFinished"
    );

    setTimeout(() => {
        startVoting(roomCode);
    }, 900);
}

// =============================
// START VOTING
// =============================

// =============================
// NEXT ROUND — KEEP SAME WORD
// =============================

socket.on("nextRoundSameWord", ({ roomCode, playerToken }) => {
    const room = rooms[roomCode];
    const game = room && room.game;

    if (!room || !game || !game.active || game.phase !== "voting") return;

    const player = room.players.find(p => p.token === playerToken);
    const activePlayers = getActivePlayers(room);
    if (!player || !activePlayers.some(p => p.token === playerToken)) return;

    if (!game.nextRoundPlayers) game.nextRoundPlayers = new Set();
    if (game.nextRoundPlayers.has(playerToken)) return;
    if (game.votes && game.votes[playerToken]) return;

    game.nextRoundPlayers.add(playerToken);

    const skipCount = game.nextRoundPlayers.size;
    const playerCount = activePlayers.length;
    const votedCount = Object.keys(game.votes || {}).length;

    io.to(roomCode).emit("voteChoiceUpdate", {
        votedCount,
        skipCount,
        playerCount,
        skipMajority: skipCount > playerCount / 2
    });

    if (skipCount > playerCount / 2) {
        startContinuationRound(roomCode, {
            sameWord: true,
            message: "Most players skipped the vote. The same word continues."
        });
    }
});

socket.on("submitVote", ({ roomCode, playerToken, targetToken }) => {
    const room = rooms[roomCode];
    const game = room && room.game;

    if (!room || !game || !game.active || game.phase !== "voting") return;

    const activePlayers = getActivePlayers(room);
    const voter = activePlayers.find(player => player.token === playerToken);
    const target = activePlayers.find(player => player.token === targetToken);

    if (!voter || !target || voter.token === target.token) return;
    if (game.nextRoundPlayers && game.nextRoundPlayers.has(playerToken)) return;

    if (!game.votes) game.votes = {};
    if (game.votes[playerToken]) return;

    game.votes[playerToken] = targetToken;

    const votedCount = Object.keys(game.votes).length;
    const skipCount = game.nextRoundPlayers?.size || 0;
    const playerCount = activePlayers.length;

    io.to(roomCode).emit("voteChoiceUpdate", {
        votedCount,
        skipCount,
        playerCount,
        skipMajority: skipCount > playerCount / 2
    });

    const targetVotes = Object.values(game.votes).filter(token => token === targetToken).length;
    if (targetVotes > playerCount / 2) {
        finishVoting(roomCode, targetToken);
        return;
    }

    if (votedCount + skipCount === playerCount) {
        io.to(roomCode).emit("voteNoMajority", {
            message: "No player received a majority. The vote is inconclusive — the same word continues."
        });
        startContinuationRound(roomCode, {
            sameWord: true,
            message: "No majority. The vote is inconclusive, so the same word continues."
        });
    }
});



// =============================
// CONTINUE MATCH / NEW DRAWING ROUND
// =============================

function startContinuationRound(roomCode, options = {}) {
    const room = rooms[roomCode];
    if (!room || !room.game || !room.game.active) return;

    const game = room.game;
    if (game.phase !== "voting") return;

    const sameWord = options.sameWord !== false;
    const activePlayers = getActivePlayers(room);

    if (activePlayers.length < 3) {
        game.active = false;
        game.phase = "results";
        io.to(roomCode).emit("gameError", "Not enough active players to continue the match.");
        return;
    }

    if (game.turnTimer) {
        clearTimeout(game.turnTimer);
        game.turnTimer = null;
    }

    // Lock the voting phase immediately so two near-simultaneous votes/skips
    // cannot start two continuation rounds.
    game.phase = "transition";

    if (options.eliminatedToken) {
        game.eliminatedTokens.add(options.eliminatedToken);
    }

    if (!sameWord) {
        game.secretWord = wordBank[randomIndex(wordBank.length)];
    }

    const nextRound = (game.round || 1) + 1;
    const transitionMessage = options.message || (
        sameWord ? "The same word continues." : "A new word is ready."
    );

    io.to(roomCode).emit("roundTransition", {
        round: nextRound,
        sameWord,
        eliminatedToken: options.eliminatedToken || null,
        message: transitionMessage
    });

    // Give everyone a moment to see what happened before revealing the next
    // word/role. This is especially important when an imposter was caught.
    setTimeout(() => {
        const currentRoom = rooms[roomCode];
        if (!currentRoom || !currentRoom.game || !currentRoom.game.active) return;

        const currentGame = currentRoom.game;
        if (currentGame.phase !== "transition") return;

        const currentActivePlayers = getActivePlayers(currentRoom);
        if (currentActivePlayers.length < 3) {
            currentGame.active = false;
            currentGame.phase = "results";
            io.to(roomCode).emit("gameError", "Not enough active players to continue the match.");
            return;
        }

        currentGame.round = nextRound;
        currentGame.phase = "roleReveal";
        currentGame.readyPlayers = new Set();
        currentGame.votes = {};
        currentGame.nextRoundPlayers = new Set();
        currentGame.currentTurnIndex = 0;
        currentGame.turnEndsAt = null;
        currentGame.turnOrder = currentActivePlayers.map(player => player.token);
        currentGame.playerData = {};

        const usedClues = new Set();
        currentRoom.players.forEach((player) => {
            if (currentGame.eliminatedTokens.has(player.token)) {
                currentGame.playerData[player.token] = {
                    role: "eliminated",
                    round: currentGame.round
                };
                return;
            }

            if (currentGame.imposterTokens.includes(player.token)) {
                const clue = getImposterClue(currentGame.secretWord, usedClues);
                usedClues.add(clue);
                currentGame.playerData[player.token] = {
                    role: "imposter",
                    clue,
                    round: currentGame.round
                };
            } else {
                currentGame.playerData[player.token] = {
                    role: "player",
                    word: currentGame.secretWord,
                    round: currentGame.round
                };
            }
        });

        io.to(roomCode).emit("roundContinued", {
            round: currentGame.round,
            sameWord,
            eliminatedToken: options.eliminatedToken || null,
            message: transitionMessage
        });

        console.log(
            `🔄 Round ${currentGame.round} started in ${roomCode} (${sameWord ? "same word" : "new word"})`
        );
    }, 1600);
}

function startVoting(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.game || !room.game.active) return;

    const game = room.game;
    const activePlayers = getActivePlayers(room);
    game.phase = "voting";
    game.votes = {};
    game.nextRoundPlayers = new Set();

    io.to(roomCode).emit("votingStarted", {
        playerCount: activePlayers.length,
        players: activePlayers.map(player => ({
            token: player.token,
            name: player.name
        }))
    });

    console.log(`🗳️ Voting started in room ${roomCode} with ${activePlayers.length} active players`);
}


function finishVoting(roomCode, majorityTargetToken = null) {
    const room = rooms[roomCode];
    if (!room || !room.game || !room.game.active) return;

    const game = room.game;
    const activePlayers = getActivePlayers(room);
    const playerCount = activePlayers.length;

    const voteCounts = {};
    activePlayers.forEach(player => {
        voteCounts[player.token] = 0;
    });

    Object.values(game.votes || {}).forEach(targetToken => {
        if (voteCounts[targetToken] !== undefined) voteCounts[targetToken]++;
    });

    const targetToken = majorityTargetToken || Object.keys(voteCounts)
        .find(token => voteCounts[token] > playerCount / 2) || null;

    if (!targetToken) {
        io.to(roomCode).emit("voteNoMajority", {
            message: "No player received a majority. The vote is inconclusive — the same word continues."
        });
        startContinuationRound(roomCode, {
            sameWord: true,
            message: "No majority. The vote is inconclusive, so the same word continues."
        });
        return;
    }

    const targetPlayer = activePlayers.find(player => player.token === targetToken);
    const isImposter = game.imposterTokens.includes(targetToken);

    if (isImposter) {
        const caughtLabel = game.imposterLabels?.[targetToken] || 1;
        const caughtName = targetPlayer?.name || "The imposter";

        // Catch exactly one imposter. If another imposter remains, continue the match.
        game.imposterTokens = game.imposterTokens.filter(token => token !== targetToken);

        const remainingImposters = game.imposterTokens.length;

        if (remainingImposters > 0) {
            const remainingLabel = game.imposterLabels?.[game.imposterTokens[0]] || 2;
            game.phase = "transition";
            io.to(roomCode).emit("imposterCaughtContinue", {
                caughtName,
                caughtLabel,
                remainingImposters,
                remainingLabel,
                message: `Imposter ${caughtLabel} caught — Imposter ${remainingLabel} is still in the game.`
            });

            startContinuationRound(roomCode, {
                sameWord: false,
                eliminatedToken: targetToken,
                message: `Imposter ${caughtLabel} caught. Imposter ${remainingLabel} is still there. New word incoming.`
            });
            return;
        }

        // Last imposter caught: players win the match. Restore the caught imposter
        // briefly so the scoring helper can evaluate the winning round correctly.
        game.imposterTokens = [targetToken];
        game.phase = "results";
        game.active = false;

        const players = room.players.map(player => ({
            token: player.token,
            name: player.name,
            votes: voteCounts[player.token] || 0,
            imposter: player.token === targetToken
        }));

        const roundPoints = applyRoundScores(room, game, "players", "vote");
        players.forEach(player => {
            player.points = roundPoints[player.token] || 0;
            player.score = room.scores[player.token] || 0;
            player.streak = room.streaks[player.token] || 0;
        });

        io.to(roomCode).emit("votingResults", {
            playersWon: true,
            caughtNames: [caughtName],
            players,
            final: true
        });
        return;
    }

    // Majority selected an innocent: no imposter is caught, so continue with the same word.
    startContinuationRound(roomCode, {
        sameWord: true,
        message: `${targetPlayer?.name || "A player"} got the majority, but they were not the imposter. The same word continues.`
    });
}


// =============================
// PLAY AGAIN
// =============================

socket.on("playAgain", ({ roomCode, playerToken }) => {

    const room = rooms[roomCode];
    if (!room || !room.game || room.game.phase !== "results") return;

    if (!room.game.playAgainPlayers) {
        room.game.playAgainPlayers = new Set();
    }

    const player = room.players.find(p => p.token === playerToken);
    if (!player) return;

    room.game.playAgainPlayers.add(playerToken);

    const readyCount = room.game.playAgainPlayers.size;
    const playerCount = room.players.length;

    io.to(roomCode).emit("playAgainWaiting", {
        readyCount,
        playerCount,
        readyTokens: Array.from(room.game.playAgainPlayers)
    });

    if (readyCount >= playerCount) {
        // Reset game state and start a fresh round.
        const secretWord = wordBank[randomIndex(wordBank.length)];
        const imposterCount = room.players.length >= 6 ? 2 : 1;
        const shuffled = shuffleArray(room.players);
        const imposters = shuffled.slice(0, imposterCount);
        const imposterTokens = imposters.map(player => player.token);

        ensureScoreboard(room);

        room.game = {
            active: true,
            secretWord,
            imposterTokens,
            imposterLabels: Object.fromEntries(imposterTokens.map((token, index) => [token, index + 1])),
            eliminatedTokens: new Set(),
            playerData: {},
            round: (gameRound(room.game) || 1) + 1,
            phase: "roleReveal",
            readyPlayers: new Set(),
            turnOrder: room.players.map(player => player.token),
            currentTurnIndex: 0,
            turnDuration: 30000,
            turnEndsAt: null,
            turnTimer: null
        };

        const usedClues = new Set();

        room.players.forEach((player) => {
            if (imposterTokens.includes(player.token)) {
                const clue = getImposterClue(secretWord, usedClues);
                usedClues.add(clue);

                room.game.playerData[player.token] = {
                    role: "imposter",
                    clue,
                    round: room.game.round
                };
            } else {
                room.game.playerData[player.token] = {
                    role: "player",
                    word: secretWord,
                    round: room.game.round
                };
            }
        });

        io.to(roomCode).emit("playAgainStarted", {
            round: room.game.round,
            playerCount: room.players.length
        });
    }
});

function gameRound(game) {
    return game && game.round ? game.round : 1;
}


// =============================
// DISCONNECT / LEAVE
// =============================

function removePlayerFromRoom(roomCode, playerToken, reason = "left") {
    const room = rooms[roomCode];
    if (!room) return;

    const index = room.players.findIndex(p => p.token === playerToken);
    if (index === -1) return;

    const game = room.game;
    const wasCurrentDrawer = Boolean(
        game &&
        game.phase === "drawing" &&
        game.turnOrder?.[game.currentTurnIndex] === playerToken
    );

    if (game?.turnOrder && index < game.currentTurnIndex) {
        game.currentTurnIndex = Math.max(0, game.currentTurnIndex - 1);
    }

    const [removed] = room.players.splice(index, 1);

    if (room.scores) delete room.scores[playerToken];
    if (room.streaks) delete room.streaks[playerToken];

    if (game) {
        game.readyPlayers?.delete(playerToken);
        game.playAgainPlayers?.delete(playerToken);
        if (game.votes) delete game.votes[playerToken];
        if (game.turnOrder) {
            game.turnOrder = game.turnOrder.filter(t => t !== playerToken);
            if (game.currentTurnIndex >= game.turnOrder.length) {
                game.currentTurnIndex = Math.max(0, game.turnOrder.length - 1);
            }
        }
        game.imposterTokens = (game.imposterTokens || []).filter(t => t !== playerToken);
    }

    if (room.players.length === 0) {
        delete rooms[roomCode];
        console.log(`Room ${roomCode} deleted`);
        return;
    }

    if (room.hostToken === playerToken) {
        room.hostToken = room.players[0].token;
    }

    io.to(roomCode).emit("playerLeft", {
        playerToken,
        playerName: removed.name,
        playerCount: room.players.length,
        reason
    });

    updateRoom(roomCode);

    if (room.game?.playAgainPlayers) {
        io.to(roomCode).emit("playAgainWaiting", {
            readyCount: room.game.playAgainPlayers.size,
            playerCount: room.players.length,
            readyTokens: Array.from(room.game.playAgainPlayers)
        });
    }

    // If the current drawer disconnects, advance immediately instead of waiting
    // for the old turn timer.
    if (wasCurrentDrawer && room.game?.active && room.game.phase === "drawing") {
        if (room.game.turnTimer) {
            clearTimeout(room.game.turnTimer);
            room.game.turnTimer = null;
        }
        setTimeout(() => startDrawingTurn(roomCode), 0);
    }

    console.log(`${removed.name} left room ${roomCode} (${reason})`);
}

socket.on("leaveRoom", ({ roomCode, playerToken }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.token === playerToken);
    if (!player || player.id !== socket.id) return;
    removePlayerFromRoom(roomCode, playerToken, "left");
});

socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    for (const roomCode in rooms) {
        const room = rooms[roomCode];
        const player = room.players.find(p => p.id === socket.id);
        if (!player) continue;

        // A short grace period covers the normal lobby -> game page navigation.
        // If the player reconnects with the same token, they are not treated as left.
        const token = player.token;
        const oldSocketId = socket.id;

        setTimeout(() => {
            const currentRoom = rooms[roomCode];
            if (!currentRoom) return;
            const stillPlayer = currentRoom.players.find(p => p.token === token);
            if (stillPlayer && stillPlayer.id === oldSocketId) {
                removePlayerFromRoom(roomCode, token, "disconnected");
            }
        }, 5000);
        break;
    }
});

});

function updateRoom(roomCode) {

    const room = rooms[roomCode];

    if (!room) {
        return;
    }

    io.to(roomCode).emit("roomUpdated", {

        players: room.players.map(player => ({

            name: player.name,

            isHost:
                player.token === room.hostToken

        })),

        playerCount:
            room.players.length

    });

}


function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {

        code = "";

        for (let i = 0; i < 6; i++) {

            code += characters.charAt(
                Math.floor(
                    Math.random() * characters.length
                )
            );

        }

    } while (rooms[code]);

    return code;

}


server.listen(PORT, () => {

    console.log(
        `🔥 Imposter Ink server running at http://localhost:${PORT}`
    );

});