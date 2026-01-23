const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let gameStarted = false;

io.on('connection', (socket) => {
    // Gestion de la connexion
    socket.on('joinGame', (name) => {
        const player = {
            id: socket.id,
            name: name,
            isHost: players.length === 0,
            alive: true,
            role: '',
            word: ''
        };
        players.push(player);
        io.emit('lobbyUpdate', players);
    });

    // Lancement du jeu
    socket.on('requestStart', (settings) => {
        if (players.length < 3) return socket.emit('errorMsg', 'Il faut au moins 3 joueurs !');
        
        gameStarted = true;
        // Ici, on pourrait ajouter une logique de distribution de mots aléatoires
        // Pour l'exemple, on envoie un mot fixe
        players.forEach(p => {
            p.role = 'Citoyen';
            p.word = 'Pomme';
            io.to(p.id).emit('gameStarted', { role: p.role, word: p.word });
        });
        
        io.emit('updateTurn', { currentId: players[0].id, currentName: players[0].name });
    });

    // Chat / Indices
    socket.on('sendWord', (word) => {
        const player = players.find(p => p.id === socket.id);
        if (player) {
            io.emit('newWord', { name: player.name, word: word });
            // Logique de passage de tour simplifiée
            const currentIndex = players.findIndex(p => p.id === socket.id);
            const nextIndex = (currentIndex + 1) % players.length;
            io.emit('updateTurn', { currentId: players[nextIndex].id, currentName: players[nextIndex].name });
        }
    });

    // Vote
    socket.on('startVotePhase', () => {
        io.emit('votePhaseStarted', players.filter(p => p.alive));
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('lobbyUpdate', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));