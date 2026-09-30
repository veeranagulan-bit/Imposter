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

const imageLibrary = [
    {
        id: "img1", category: "Food", topic: "Apple",
        url: "/images/Apple.jpg",
        relatedTopic: "Tomato",
        relatedUrl: "/images/Tomato.jpg"
    },
    {
        id: "img2", category: "Animals", topic: "Cat",
        url: "/images/Cat.jpg",
        relatedTopic: "Tiger",
        relatedUrl: "/images/Tiger.jpg"
    },
    {
        id: "img3", category: "Vehicles", topic: "School Bus",
        url: "/images/School_Bus.jpg",
        relatedTopic: "City Bus",
        relatedUrl: "/images/City_Bus.jpg"
    },
    {
        id: "img4", category: "Sports", topic: "Football",
        url: "/images/Football.jpg",
        relatedTopic: "Basketball",
        relatedUrl: "/images/Basketball.jpg"
    },
    {
        id: "img5", category: "Household Objects", topic: "Coffee Mug",
        url: "/images/Coffee_Mug.jpg",
        relatedTopic: "Teapot",
        relatedUrl: "/images/Teapot.jpg"
    },
    {
        id: "img6", category: "Nature", topic: "Sunflower",
        url: "/images/Sunflower.jpg",
        relatedTopic: "Rose",
        relatedUrl: "/images/Rose.jpg"
    },
    {
        id: "img7", category: "Technology", topic: "Laptop",
        url: "/images/Laptop.jpg",
        relatedTopic: "Desktop Computer",
        relatedUrl: "/images/Desktop_Computer.jpg"
    },
    {
        id: "img8", category: "Places", topic: "Eiffel Tower",
        url: "/images/Eiffel_Tower.jpg",
        relatedTopic: "Statue of Liberty",
        relatedUrl: "/images/Statue_of_Liberty.jpg"
    }
];

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
            roundPoints[player.token] += winner === "imposter" ? 150 : 100;
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

function gameRound(game) {
    return game && game.round ? game.round : 1;
}

io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("createRoom", ({ playerName, playerToken }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { hostToken: playerToken, players: [] };
        rooms[roomCode].players.push({ id: socket.id, token: playerToken, name: playerName });
        socket.join(roomCode);
        socket.emit("roomCreated", { roomCode });
        updateRoom(roomCode);
        console.log(`${playerName} created room ${roomCode}`);
    });

    socket.on("joinRoom", ({ roomCode, playerName, playerToken }) => {
        roomCode = roomCode.toUpperCase();
        const room = rooms[roomCode];
        if (!room) { socket.emit("joinError", "Room does not exist."); return; }
        if (room.players.length >= 8) { socket.emit("joinError", "Room is full."); return; }

        const existingPlayer = room.players.find(player => player.token === playerToken);
        const safeName = (playerName || "Player").trim();
        if (existingPlayer) {
            existingPlayer.id = socket.id;
            existingPlayer.name = safeName;
        } else {
            const cleanName = safeName;
            const nameTaken = room.players.some(player => player.name.trim().toLowerCase() === cleanName.toLowerCase());
            if (nameTaken) { socket.emit("joinError", "That player name is already taken in this room."); return; }
            room.players.push({ id: socket.id, token: playerToken, name: cleanName });
        }
        socket.join(roomCode);
        socket.emit("joinedRoom", { roomCode });
        updateRoom(roomCode);
    });

    socket.on("reconnectToRoom", ({ roomCode, playerToken }) => {
        const room = rooms[roomCode];
        if (!room) return;
        const player = room.players.find(player => player.token === playerToken);
        if (!player) return;
        player.id = socket.id;
        socket.join(roomCode);
        socket.emit("reconnected", { roomCode });
        updateRoom(roomCode);
    });

    socket.on("startGame", ({ roomCode, gameMode }) => {
        const room = rooms[roomCode];
        if (!room) { socket.emit("gameError", "Room does not exist."); return; }

        const host = room.players.find(player => player.token === room.hostToken);
        if (!host || host.id !== socket.id) { socket.emit("gameError", "Only the host can start the game."); return; }
        if (room.players.length < 3) { socket.emit("gameError", "At least 3 players are required."); return; }
        if (room.game && room.game.active) { socket.emit("gameError", "Game has already started."); return; }

        const secretImage = imageLibrary[randomIndex(imageLibrary.length)];
        const imposterCount = room.players.length >= 6 ? 2 : 1;
        const shuffled = shuffleArray(room.players);
        const imposters = shuffled.slice(0, imposterCount);
        const imposterTokens = imposters.map(player => player.token);

        ensureScoreboard(room);

        room.game = {
            active: true,
            gameMode: gameMode || "hidden_image",
            secretImage,
            imposterTokens,
            imposterLabels: Object.fromEntries(imposterTokens.map((token, index) => [token, index + 1])),
            eliminatedTokens: new Set(),
            playerData: {},
            round: 1,
            phase: "roleReveal",
            readyPlayers: new Set(),
            turnDuration: 45000,
            turnEndsAt: null,
            turnTimer: null,
            clues: {}
        };

        room.players.forEach((player) => {
            const isImposter = imposterTokens.includes(player.token);
            if (isImposter) {
                room.game.playerData[player.token] = {
                    role: "imposter",
                    hint: room.game.gameMode === "hidden_image" ? secretImage.category : null,
                    image: room.game.gameMode === "similar_image" ? { url: secretImage.relatedUrl, topic: secretImage.relatedTopic } : null,
                    round: 1
                };
            } else {
                room.game.playerData[player.token] = {
                    role: "player",
                    image: { url: secretImage.url, topic: secretImage.topic },
                    round: 1
                };
            }
        });

        io.to(roomCode).emit("gameStarting");
    });

    socket.on("getGameData", ({ roomCode, playerToken }) => {
        const room = rooms[roomCode];
        if (!room || !room.game || !room.game.active) { socket.emit("gameError", "Game is not active."); return; }
        const player = room.players.find(p => p.token === playerToken);
        if (!player) { socket.emit("gameError", "Player not found."); return; }
        
        player.id = socket.id;
        socket.join(roomCode);
        const privateData = room.game.playerData[playerToken];
        if (!privateData) { socket.emit("gameError", "Game data not found."); return; }

        socket.emit("gameStarted", {
            ...privateData,
            phase: room.game.phase,
            readyCount: room.game.readyPlayers.size,
            playerCount: getActivePlayers(room).length,
            turnEndsAt: room.game.turnEndsAt,
            score: room.scores && room.scores[playerToken] !== undefined ? room.scores[playerToken] : 0,
            submittedClue: room.game.clues?.[playerToken],
            allClues: room.game.phase === "clueReveal" || room.game.phase === "voting" || room.game.phase === "results" ? 
                      getActivePlayers(room).map(p => ({ token: p.token, name: p.name, clue: room.game.clues[p.token] || "No clue" })) : null
        });
    });

    socket.on("playerReady", ({ roomCode, playerToken }) => {
        const room = rooms[roomCode];
        if (!room || !room.game || !room.game.active) return;
        const player = room.players.find(p => p.token === playerToken);
        if (!player) return;
        if (room.game.eliminatedTokens?.has(playerToken)) return;

        room.game.readyPlayers.add(playerToken);
        const readyCount = room.game.readyPlayers.size;
        const playerCount = getActivePlayers(room).length;
        
        io.to(roomCode).emit("readyUpdate", { readyCount, playerCount });

        if (readyCount === playerCount) {
            startClueSubmission(roomCode);
        }
    });

    socket.on("submitClue", ({ roomCode, playerToken, clue }) => {
        const room = rooms[roomCode];
        if (!room || !room.game || !room.game.active || room.game.phase !== "clueSubmission") return;
        if (room.game.eliminatedTokens.has(playerToken)) return;
        
        const cleanClue = String(clue || "").trim().slice(0, 30);
        if (!cleanClue) return;
        
        if (!room.game.clues) room.game.clues = {};
        if (room.game.clues[playerToken]) return;
        
        const normalize = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
        const topic = normalize(room.game.secretImage.topic);
        const relatedTopic = normalize(room.game.secretImage.relatedTopic);
        const clueNormalized = normalize(cleanClue);
        
        if (clueNormalized.includes(topic) || (room.game.gameMode === "similar_image" && clueNormalized.includes(relatedTopic))) {
            socket.emit("clueRejected", { message: "Your clue is too similar to the secret answer!" });
            return;
        }
        
        room.game.clues[playerToken] = cleanClue;
        const activePlayers = getActivePlayers(room);
        const submittedCount = Object.keys(room.game.clues).length;
        
        io.to(roomCode).emit("clueSubmissionUpdate", { submittedCount, totalCount: activePlayers.length });
        
        if (submittedCount >= activePlayers.length) {
            finishClueSubmission(roomCode);
        }
    });

    socket.on("sendChat", ({ roomCode, playerToken, message }) => {
        const room = rooms[roomCode];
        if (!room || !room.game || !room.game.active || !["clueReveal", "voting"].includes(room.game.phase)) return;
        const player = room.players.find(p => p.token === playerToken);
        if (!player) return;

        const cleanMessage = String(message || "").trim().slice(0, 160);
        if (!cleanMessage) return;

        const topicStr = room.game?.secretImage?.topic || "";
        if (topicStr && cleanMessage.toLowerCase().includes(topicStr.toLowerCase())) {
            socket.emit("chatRejected", { message: "Don't reveal the secret!" });
            return;
        }

        io.to(roomCode).emit("chatMessage", {
            playerToken, playerName: player.name, message: cleanMessage, sentAt: Date.now()
        });
    });

    function startClueSubmission(roomCode) {
        const room = rooms[roomCode];
        if (!room || !room.game || !room.game.active) return;
        
        const game = room.game;
        if (game.turnTimer) clearTimeout(game.turnTimer);
        
        game.phase = "clueSubmission";
        game.clues = {};
        game.turnEndsAt = Date.now() + game.turnDuration;
        
        io.to(roomCode).emit("clueSubmissionStarted", { turnEndsAt: game.turnEndsAt, duration: game.turnDuration });
        
        game.turnTimer = setTimeout(() => {
            finishClueSubmission(roomCode);
        }, game.turnDuration);
    }

    function finishClueSubmission(roomCode) {
        const room = rooms[roomCode];
        if (!room || !room.game || !room.game.active) return;
        
        const game = room.game;
        if (game.turnTimer) clearTimeout(game.turnTimer);
        game.turnTimer = null;
        game.phase = "clueReveal";
        
        const activePlayers = getActivePlayers(room);
        const cluesList = activePlayers.map(p => ({
            token: p.token, name: p.name, clue: game.clues[p.token] || "No clue"
        }));
        
        io.to(roomCode).emit("clueRevealStarted", { clues: cluesList });
        
        // Start voting automatically after a few seconds of reveal, or allow manual transition?
        // Let's give them 30 seconds to discuss, then auto-start voting, or we can just keep them in reveal mode until someone triggers voting.
        // The previous game triggered voting automatically. Let's start voting after 10 seconds.
        game.turnTimer = setTimeout(() => {
            startVoting(roomCode);
        }, 15000);
    }

    // Replace old nextRoundSameWord with startContinuationRound equivalent if needed
    // Actually, to save space, let's keep it simple.
    
    socket.on("nextRoundSameWord", ({ roomCode, playerToken }) => {
        const room = rooms[roomCode];
        if (!room || !room.game || !room.game.active || room.game.phase !== "voting") return;
        if (!room.game.nextRoundPlayers) room.game.nextRoundPlayers = new Set();
        room.game.nextRoundPlayers.add(playerToken);
        const activePlayers = getActivePlayers(room);
        const skipCount = room.game.nextRoundPlayers.size;
        
        io.to(roomCode).emit("voteChoiceUpdate", {
            votedCount: Object.keys(room.game.votes || {}).length,
            skipCount, playerCount: activePlayers.length,
            skipMajority: skipCount > activePlayers.length / 2
        });
        
        if (skipCount > activePlayers.length / 2) {
            startContinuationRound(roomCode, { sameWord: true });
        }
    });

    socket.on("submitVote", ({ roomCode, playerToken, targetToken }) => {
        const room = rooms[roomCode];
        const game = room && room.game;
        if (!room || !game || !game.active || game.phase !== "voting") return;
        const activePlayers = getActivePlayers(room);
        if (playerToken === targetToken) return;
        
        if (!game.votes) game.votes = {};
        if (game.votes[playerToken]) return;
        
        game.votes[playerToken] = targetToken;
        const votedCount = Object.keys(game.votes).length;
        const skipCount = game.nextRoundPlayers?.size || 0;
        const playerCount = activePlayers.length;
        
        io.to(roomCode).emit("voteChoiceUpdate", { votedCount, skipCount, playerCount, skipMajority: false });
        
        const targetVotes = Object.values(game.votes).filter(t => t === targetToken).length;
        if (targetVotes > playerCount / 2) {
            finishVoting(roomCode, targetToken);
            return;
        }
        
        if (votedCount + skipCount === playerCount) {
            startContinuationRound(roomCode, { sameWord: true, message: "No majority. The vote is inconclusive, so the same image continues." });
        }
    });

    function startContinuationRound(roomCode, options = {}) {
        const room = rooms[roomCode];
        if (!room || !room.game || !room.game.active) return;
        const game = room.game;
        game.phase = "transition";
        if (game.turnTimer) { clearTimeout(game.turnTimer); game.turnTimer = null; }
        
        if (options.eliminatedToken) game.eliminatedTokens.add(options.eliminatedToken);
        
        if (!options.sameWord) {
            game.secretImage = imageLibrary[randomIndex(imageLibrary.length)];
        }
        
        const nextRound = (game.round || 1) + 1;
        io.to(roomCode).emit("roundTransition", { round: nextRound, sameWord: options.sameWord, eliminatedToken: options.eliminatedToken, message: options.message });
        
        setTimeout(() => {
            const currentRoom = rooms[roomCode];
            if (!currentRoom || !currentRoom.game || !currentRoom.game.active) return;
            const currentGame = currentRoom.game;
            currentGame.round = nextRound;
            currentGame.phase = "roleReveal";
            currentGame.readyPlayers = new Set();
            currentGame.votes = {};
            currentGame.nextRoundPlayers = new Set();
            currentGame.clues = {};
            currentGame.playerData = {};
            
            currentRoom.players.forEach((player) => {
                if (currentGame.eliminatedTokens.has(player.token)) {
                    currentGame.playerData[player.token] = { role: "eliminated", round: currentGame.round };
                    return;
                }
                if (currentGame.imposterTokens.includes(player.token)) {
                    let newHint = currentGame.secretImage.category;
                    if (currentGame.gameMode === "hidden_image" && currentGame.round > 1) {
                        const topicStr = currentGame.secretImage.topic;
                        newHint += ` | Starts with '${topicStr.charAt(0).toUpperCase()}'`;
                    }
                    
                    currentGame.playerData[player.token] = {
                        role: "imposter",
                        hint: currentGame.gameMode === "hidden_image" ? newHint : null,
                        image: currentGame.gameMode === "similar_image" ? { url: currentGame.secretImage.relatedUrl, topic: currentGame.secretImage.relatedTopic } : null,
                        round: currentGame.round
                    };
                } else {
                    currentGame.playerData[player.token] = {
                        role: "player",
                        image: { url: currentGame.secretImage.url, topic: currentGame.secretImage.topic },
                        round: currentGame.round
                    };
                }
            });
            
            io.to(roomCode).emit("roundContinued", { round: currentGame.round, sameWord: options.sameWord, eliminatedToken: options.eliminatedToken, message: options.message });
        }, 2000);
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
            players: activePlayers.map(p => ({ token: p.token, name: p.name }))
        });
    }

    function finishVoting(roomCode, targetToken) {
        const room = rooms[roomCode];
        if (!room || !room.game || !room.game.active) return;
        const game = room.game;
        const activePlayers = getActivePlayers(room);
        const targetPlayer = activePlayers.find(p => p.token === targetToken);
        const isImposter = game.imposterTokens.includes(targetToken);
        
        if (isImposter) {
            const caughtName = targetPlayer?.name || "The imposter";
            game.imposterTokens = game.imposterTokens.filter(t => t !== targetToken);
            
            if (game.imposterTokens.length > 0) {
                startContinuationRound(roomCode, { sameWord: false, eliminatedToken: targetToken, message: "An imposter was caught, but another remains!" });
                return;
            }
            
            game.imposterTokens = [targetToken];
            game.phase = "results";
            game.active = false;
            
            const players = room.players.map(p => ({
                token: p.token, name: p.name, votes: Object.values(game.votes).filter(t => t === p.token).length, imposter: p.token === targetToken
            }));
            
            const roundPoints = applyRoundScores(room, game, "players", "vote");
            players.forEach(p => {
                p.points = roundPoints[p.token] || 0; p.score = room.scores[p.token] || 0; p.streak = room.streaks[p.token] || 0;
            });
            
            io.to(roomCode).emit("votingResults", {
                playersWon: true, caughtNames: [caughtName], players, final: true, secretImage: game.secretImage, mode: game.gameMode
            });
        } else {
            startContinuationRound(roomCode, { sameWord: true, message: `${targetPlayer?.name} was innocent. The same image continues.` });
        }
    }

    socket.on("playAgain", ({ roomCode, playerToken }) => {
        const room = rooms[roomCode];
        if (!room || !room.game || room.game.phase !== "results") return;
        if (!room.game.playAgainPlayers) room.game.playAgainPlayers = new Set();
        room.game.playAgainPlayers.add(playerToken);
        
        const readyCount = room.game.playAgainPlayers.size;
        const playerCount = room.players.length;
        io.to(roomCode).emit("playAgainWaiting", { readyCount, playerCount, readyTokens: Array.from(room.game.playAgainPlayers) });
        
        if (readyCount >= playerCount) {
            const secretImage = imageLibrary[randomIndex(imageLibrary.length)];
            const imposterCount = room.players.length >= 6 ? 2 : 1;
            const shuffled = shuffleArray(room.players);
            const imposters = shuffled.slice(0, imposterCount);
            const imposterTokens = imposters.map(p => p.token);
            ensureScoreboard(room);
            
            room.game = {
                active: true, gameMode: room.game.gameMode, secretImage, imposterTokens,
                imposterLabels: Object.fromEntries(imposterTokens.map((t, i) => [t, i + 1])),
                eliminatedTokens: new Set(), playerData: {}, round: (gameRound(room.game) || 1) + 1,
                phase: "roleReveal", readyPlayers: new Set(), turnDuration: 45000, turnEndsAt: null, turnTimer: null, clues: {}
            };
            
            room.players.forEach((player) => {
                if (imposterTokens.includes(player.token)) {
                    room.game.playerData[player.token] = {
                        role: "imposter",
                        hint: room.game.gameMode === "hidden_image" ? secretImage.category : null,
                        image: room.game.gameMode === "similar_image" ? { url: secretImage.relatedUrl, topic: secretImage.relatedTopic } : null,
                        round: room.game.round
                    };
                } else {
                    room.game.playerData[player.token] = { role: "player", image: { url: secretImage.url, topic: secretImage.topic }, round: room.game.round };
                }
            });
            io.to(roomCode).emit("playAgainStarted", { round: room.game.round, playerCount: room.players.length });
        }
    });

    socket.on("leaveRoom", ({ roomCode, playerToken }) => {
        removePlayerFromRoom(roomCode, playerToken, "left");
    });
    
    socket.on("disconnect", () => {
        console.log("Player disconnected:", socket.id);
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const player = room.players.find(p => p.id === socket.id);
            if (!player) continue;
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
    
    function removePlayerFromRoom(roomCode, playerToken, reason = "left") {
        const room = rooms[roomCode];
        if (!room) return;
        const index = room.players.findIndex(p => p.token === playerToken);
        if (index === -1) return;
        const [removed] = room.players.splice(index, 1);
        if (room.scores) delete room.scores[playerToken];
        if (room.streaks) delete room.streaks[playerToken];
        if (room.game) {
            room.game.readyPlayers?.delete(playerToken);
            room.game.playAgainPlayers?.delete(playerToken);
            if (room.game.votes) delete room.game.votes[playerToken];
            room.game.imposterTokens = (room.game.imposterTokens || []).filter(t => t !== playerToken);
        }
        if (room.players.length === 0) { delete rooms[roomCode]; return; }
        if (room.hostToken === playerToken) room.hostToken = room.players[0].token;
        io.to(roomCode).emit("playerLeft", { playerToken, playerName: removed.name, playerCount: room.players.length, reason });
        updateRoom(roomCode);
    }
});

function updateRoom(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    io.to(roomCode).emit("roomUpdated", {
        players: room.players.map(player => ({ name: player.name, isHost: player.token === room.hostToken })),
        playerCount: room.players.length,
        gameMode: room.game?.gameMode
    });
}

function generateRoomCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
        code = "";
        for (let i = 0; i < 6; i++) code += characters.charAt(Math.floor(Math.random() * characters.length));
    } while (rooms[code]);
    return code;
}

server.listen(PORT, () => {
    console.log(`🔥 Imposter Ink server running at http://localhost:${PORT}`);
});