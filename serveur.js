const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sert les fichiers HTML/JS du dossier 'public'
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Joueur connecté:', socket.id);

    socket.on('joinGame', (username) => {
        console.log(`${username} a rejoint la partie`);
        // Ici, on pourra ajouter la logique de distribution des mots
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
});