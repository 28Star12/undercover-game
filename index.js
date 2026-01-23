const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = []; // Liste des joueurs connectés

io.on('connection', (socket) => {
    console.log('Nouveau joueur connecté:', socket.id);

    socket.on('joinGame', (username) => {
        players.push({ id: socket.id, name: username, role: 'En attente...' });
        io.emit('updatePlayerList', players); // On prévient tout le monde
    });

    socket.on('startGame', () => {
        if (players.length < 3) return; // Il faut au moins 3 joueurs

        // Choix aléatoire de l'Undercover
        const undercoverIndex = Math.floor(Math.random() * players.length);
        
        players.forEach((player, index) => {
            if (index === undercoverIndex) {
                player.role = 'Undercover';
                player.word = 'Loup'; // Exemple
            } else {
                player.role = 'Civil';
                player.word = 'Chien'; // Exemple
            }
            io.to(player.id).emit('receiveRole', { role: player.role, word: player.word });
        });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayerList', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur sur le port ${PORT}`));