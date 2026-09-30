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
    room.players.forEach(player => roundPoints[player.token] = 10); // participation

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

function randomIndex(length) { return crypto.randomInt(0, length); }

function shuffleArray(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ... more server code later
