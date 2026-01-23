const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sert les fichiers statiques (ton index.html) depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let gameStarted = false;

io.on('connection', (socket) => {
    // Gestion de la connexion d'un nouveau joueur
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

    // Lancement du jeu par l'hôte
    socket.on('requestStart', (settings) => {
        if (players.length < 3) return socket.emit('errorMsg', 'Il faut au moins 3 joueurs !');
        
        gameStarted = true;
        // Logique simplifiée : distribution de rôles et mots
        // Dans une version complète, on piocherait dans une base de données de mots
        players.forEach(p => {
            p.role = 'Citoyen';
            p.word = 'Pomme';
            io.to(p.id).emit('gameStarted', { role: p.role, word: p.word });
        });
        
        // On définit le premier joueur qui doit parler
        io.emit('updateTurn', { currentId: players[0].id, currentName: players[0].name });
    });

    // Réception et diffusion d'un indice
    socket.on('sendWord', (word) => {
        const player = players.find(p => p.id === socket.id);
        if (player) {
            io.emit('newWord', { name: player.name, word: word });
            
            // Passage automatique au joueur suivant (logique circulaire)
            const currentIndex = players.findIndex(p => p.id === socket.id);
            const nextIndex = (currentIndex + 1) % players.length;
            io.emit('updateTurn', { currentId: players[nextIndex].id, currentName: players[nextIndex].name });
        }
    });

    // Activation de la phase de vote
    socket.on('startVotePhase', () => {
        io.emit('votePhaseStarted', players.filter(p => p.alive));
    });

    // Gestion de la déconnexion
    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('lobbyUpdate', players);
    });
});

// Port dynamique pour Render ou 3000 en local
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur Undercover lancé sur le port ${PORT}`));