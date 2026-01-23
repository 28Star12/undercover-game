const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = [];
const WORD_PAIRS = [
    ["Pomme", "Poire"], ["Chien", "Loup"], ["Avion", "Hélicoptère"],
    ["Pizza", "Burger"], ["Stylo", "Crayon"], ["Chat", "Lynx"]
];

io.on('connection', (socket) => {
    console.log('Connexion:', socket.id);

    socket.on('joinGame', (username) => {
        // Le premier arrivé devient l'hôte
        const isHost = players.length === 0;
        players.push({ id: socket.id, name: username, isHost: isHost });
        io.emit('lobbyUpdate', players);
    });

    socket.on('requestStart', (config) => {
        if (players.length < 3) {
            return socket.emit('errorMsg', 'Il faut au moins 3 joueurs !');
        }

        // 1. Choix des mots
        const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
        
        // 2. Préparation des rôles
        let roles = [];
        for (let i = 0; i < config.uCount; i++) roles.push('undercover');
        if (config.whiteEnabled) roles.push('mr_white');
        while (roles.length < players.length) roles.push('citizen');

        // 3. Mélange des rôles
        roles = roles.sort(() => Math.random() - 0.5);

        // 4. Envoi individuel à chaque joueur
        players.forEach((player, index) => {
            const myRole = roles[index];
            const myWord = (myRole === 'undercover') ? pair[1] : (myRole === 'mr_white' ? '???' : pair[0]);
            
            io.to(player.id).emit('gameStarted', {
                role: myRole,
                word: myWord
            });
        });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        if (players.length > 0) players[0].isHost = true; // Nouvel hôte si l'ancien part
        io.emit('lobbyUpdate', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));