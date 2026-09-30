import re

with open("server_backup.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Replace wordBank and clueBank
image_library_code = """
const imageLibrary = [
    {
        id: "img1", category: "Food", topic: "Apple",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Red_Apple.jpg/800px-Red_Apple.jpg",
        relatedTopic: "Tomato",
        relatedUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/800px-Tomato_je.jpg"
    },
    {
        id: "img2", category: "Animals", topic: "Cat",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/800px-Cat_November_2010-1a.jpg",
        relatedTopic: "Tiger",
        relatedUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Walking_tiger_female.jpg/800px-Walking_tiger_female.jpg"
    },
    {
        id: "img3", category: "Vehicles", topic: "School Bus",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Thomas_Saf-T-Liner_C2.jpg/800px-Thomas_Saf-T-Liner_C2.jpg",
        relatedTopic: "City Bus",
        relatedUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/LT_471_%28LTZ_1471%29_Arriva_London_New_Routemaster_%2819522859218%29.jpg/800px-LT_471_%28LTZ_1471%29_Arriva_London_New_Routemaster_%2819522859218%29.jpg"
    },
    {
        id: "img4", category: "Sports", topic: "Football",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Football_Pallo_valmiina-cropped.jpg/800px-Football_Pallo_valmiina-cropped.jpg",
        relatedTopic: "Volleyball",
        relatedUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Volleyball_%28Ball%29.jpg/800px-Volleyball_%28Ball%29.jpg"
    },
    {
        id: "img5", category: "Household Objects", topic: "Coffee Mug",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_small_cup_of_coffee.JPG/800px-A_small_cup_of_coffee.JPG",
        relatedTopic: "Teapot",
        relatedUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Teapot_with_lid.jpg/800px-Teapot_with_lid.jpg"
    },
    {
        id: "img6", category: "Nature", topic: "Sunflower",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Sunflower_sky_backdrop.jpg/800px-Sunflower_sky_backdrop.jpg",
        relatedTopic: "Rose",
        relatedUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Rosa_rubiginosa_1.jpg/800px-Rosa_rubiginosa_1.jpg"
    },
    {
        id: "img7", category: "Technology", topic: "Laptop",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/A_Laptop.jpg/800px-A_Laptop.jpg",
        relatedTopic: "Desktop Computer",
        relatedUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Desktop_computer_clipart_-_Yellow_theme.svg/800px-Desktop_computer_clipart_-_Yellow_theme.svg.png"
    }
];
"""
code = re.sub(r'const wordBank = \[.*?\];', image_library_code, code, flags=re.DOTALL)
code = re.sub(r'const clueBank = \{.*?\};\n', '', code, flags=re.DOTALL)
code = re.sub(r'function getImposterClue.*?\}\n\n', '', code, flags=re.DOTALL)

# 2. Update startGame socket event
start_game_pattern = r'socket\.on\("startGame", \(\{ roomCode \}\) => \{'
new_start_game = r'socket.on("startGame", ({ roomCode, gameMode }) => {'
code = code.replace('socket.on("startGame", ({ roomCode }) => {', 'socket.on("startGame", ({ roomCode, gameMode }) => {')

# Find the RANDOM WORD section and replace it with image selection
random_word_pattern = r'// =============================\s*// RANDOM WORD\s*// =============================\s*const secretWord =\s*wordBank\[randomIndex\(wordBank\.length\)\];'
new_random_word = r'''// =============================
    // RANDOM IMAGE
    // =============================
    const selectedImage = imageLibrary[randomIndex(imageLibrary.length)];
    gameMode = gameMode || "hidden_image";
'''
code = re.sub(random_word_pattern, new_random_word, code, flags=re.DOTALL)

# Update game state creation
create_game_pattern = r'room\.game = \{.*?active: true,.*?secretWord,.*?imposterTokens,.*?turnTimer: null\s*\};'
new_create_game = r'''room.game = {
        active: true,
        gameMode,
        secretImage: selectedImage,
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
    };'''
code = re.sub(create_game_pattern, new_create_game, code, flags=re.DOTALL)

# Update player data assignment
private_player_data_pattern = r'const usedClues = new Set\(\);\s*room\.players\.forEach\(\(player\) => \{.*?\n\s*\}\);\n'
new_private_player_data = r'''room.players.forEach((player) => {
        const isImposter = imposterTokens.includes(player.token);
        if (isImposter) {
            room.game.playerData[player.token] = {
                role: "imposter",
                hint: gameMode === "hidden_image" ? selectedImage.category : null,
                image: gameMode === "similar_image" ? { url: selectedImage.relatedUrl, topic: selectedImage.relatedTopic } : null,
                round: 1
            };
        } else {
            room.game.playerData[player.token] = {
                role: "player",
                image: { url: selectedImage.url, topic: selectedImage.topic },
                round: 1
            };
        }
    });
'''
code = re.sub(private_player_data_pattern, new_private_player_data, code, flags=re.DOTALL)

# Update getGameData score references from secretWord to secretImage (Wait, there aren't any, but just in case)
code = code.replace('Word: ${secretWord}', 'Image: ${selectedImage.topic} (${gameMode})')
code = code.replace('word: secretWord', 'image: selectedImage')

# 3. playerReady logic - startClueSubmission instead of startDrawingTurn
code = code.replace('startDrawingTurn(roomCode);', 'startClueSubmission(roomCode);')

# 4. Remove drawing related socket events and logic
drawing_events_pattern = r'// =============================\s*// DRAW START\s*// =============================.*?// START DRAWING TURN\s*// ============================='
code = re.sub(drawing_events_pattern, '// CLUE SUBMISSION EVENTS\n// =============================\n', code, flags=re.DOTALL)

# Now define startClueSubmission and clue submission events
clue_submission_logic = r'''
socket.on("submitClue", ({ roomCode, playerToken, clue }) => {
    const room = rooms[roomCode];
    if (!room || !room.game || !room.game.active || room.game.phase !== "clueSubmission") return;
    
    if (room.game.eliminatedTokens.has(playerToken)) return;
    
    const cleanClue = String(clue || "").trim().slice(0, 30);
    if (!cleanClue) return;
    
    if (!room.game.clues) room.game.clues = {};
    if (room.game.clues[playerToken]) return; // Already submitted
    
    // Prevent exact answer leaks
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
    
    io.to(roomCode).emit("clueSubmissionUpdate", {
        submittedCount,
        totalCount: activePlayers.length
    });
    
    if (submittedCount >= activePlayers.length) {
        finishClueSubmission(roomCode);
    }
});

function startClueSubmission(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.game || !room.game.active) return;
    
    const game = room.game;
    if (game.turnTimer) {
        clearTimeout(game.turnTimer);
        game.turnTimer = null;
    }
    
    game.phase = "clueSubmission";
    game.clues = {};
    game.turnEndsAt = Date.now() + game.turnDuration;
    
    io.to(roomCode).emit("clueSubmissionStarted", {
        turnEndsAt: game.turnEndsAt,
        duration: game.turnDuration
    });
    
    game.turnTimer = setTimeout(() => {
        finishClueSubmission(roomCode);
    }, game.turnDuration);
}

function finishClueSubmission(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.game || !room.game.active) return;
    
    const game = room.game;
    if (game.turnTimer) {
        clearTimeout(game.turnTimer);
        game.turnTimer = null;
    }
    
    game.phase = "clueReveal";
    
    // Build clue array
    const activePlayers = getActivePlayers(room);
    const cluesList = activePlayers.map(p => ({
        token: p.token,
        name: p.name,
        clue: game.clues[p.token] || "No clue"
    }));
    
    io.to(roomCode).emit("clueRevealStarted", {
        clues: cluesList
    });
    
    // After 10 seconds of reveal, start discussion/voting
    game.turnTimer = setTimeout(() => {
        startVoting(roomCode);
    }, 10000);
}
'''
code = re.sub(r'function startDrawingTurn.*?function finishDrawingPhase.*?\}', clue_submission_logic, code, flags=re.DOTALL)

# 5. Remove imposter guess word logic
imposter_guess_pattern = r'// =============================\s*// IMPOSTER GUESS\s*// =============================.*?// CLUE SUBMISSION EVENTS'
code = re.sub(imposter_guess_pattern, '// CLUE SUBMISSION EVENTS', code, flags=re.DOTALL)

# Update scoring reason handling in applyRoundScores if wordGuess is removed
# Actually, applyRoundScores still checks `reason === "wordGuess"` which is fine to leave or remove.

# Update startContinuationRound to pick new image instead of word
code = code.replace('game.secretWord = wordBank[randomIndex(wordBank.length)];', 'game.secretImage = imageLibrary[randomIndex(imageLibrary.length)];')
code = code.replace('const clue = getImposterClue(currentGame.secretWord, usedClues);', '/* clue removed */')

cont_round_data = r'''
            if (currentGame.imposterTokens.includes(player.token)) {
                currentGame.playerData[player.token] = {
                    role: "imposter",
                    hint: currentGame.gameMode === "hidden_image" ? currentGame.secretImage.category : null,
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
'''
code = re.sub(r'if \(currentGame\.imposterTokens\.includes\(player\.token\)\) \{.*?else \{.*?\}', cont_round_data, code, flags=re.DOTALL)
code = code.replace('sameWord ? "same word" : "new word"', 'sameWord ? "same image" : "new image"')

# Play again
play_again_pattern = r'const secretWord = wordBank\[randomIndex\(wordBank\.length\)\];.*?const imposterCount'
code = re.sub(play_again_pattern, 'const secretImage = imageLibrary[randomIndex(imageLibrary.length)];\nconst imposterCount', code, flags=re.DOTALL)
code = code.replace('secretWord,', 'secretImage,\ngameMode: room.game.gameMode,')

play_again_data = r'''
            if (imposterTokens.includes(player.token)) {
                room.game.playerData[player.token] = {
                    role: "imposter",
                    hint: room.game.gameMode === "hidden_image" ? secretImage.category : null,
                    image: room.game.gameMode === "similar_image" ? { url: secretImage.relatedUrl, topic: secretImage.relatedTopic } : null,
                    round: room.game.round
                };
            } else {
                room.game.playerData[player.token] = {
                    role: "player",
                    image: { url: secretImage.url, topic: secretImage.topic },
                    round: room.game.round
                };
            }
'''
code = re.sub(r'if \(imposterTokens\.includes\(player\.token\)\) \{.*?else \{.*?\}', play_again_data, code, flags=re.DOTALL)

# Ensure "votingResults" has image info
voting_results_pattern = r'io\.to\(roomCode\)\.emit\("votingResults", \{.*?\}\);'
new_voting_results = r'''io.to(roomCode).emit("votingResults", {
            playersWon: true,
            caughtNames: [caughtName],
            players,
            final: true,
            secretImage: game.secretImage
        });'''
code = re.sub(voting_results_pattern, new_voting_results, code, flags=re.DOTALL)

# Check for drawing/word related things in chat
chat_check_pattern = r'const compact = value =>.*?if \(secret && secret\.length >= 3 && chatText\.includes\(secret\)\) \{.*?\n\s*return;\n\s*\}'
new_chat_check = r'''
    const topicStr = room.game?.secretImage?.topic || "";
    const relatedStr = room.game?.secretImage?.relatedTopic || "";
    
    if (topicStr && cleanMessage.toLowerCase().includes(topicStr.toLowerCase())) {
        socket.emit("chatRejected", { message: "Don't reveal the secret!" });
        return;
    }
'''
code = re.sub(chat_check_pattern, new_chat_check, code, flags=re.DOTALL)
code = code.replace('game.secretWord', 'room.game.secretImage.topic')

# Disconnect logic - wasCurrentDrawer -> no longer applicable, remove it
disconnect_pattern = r'const wasCurrentDrawer.*?setTimeout\(\(\) => startDrawingTurn\(roomCode\), 0\);\n\s*\}'
code = re.sub(disconnect_pattern, '', code, flags=re.DOTALL)

# Fix missing braces or broken syntax
with open("server.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Rewrote server.js successfully")
