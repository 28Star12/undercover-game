const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let votes = {}; // Pour stocker les votes du tour actuel

// Base de mots (identique au client pour la cohérence, mais gérée ici)
const WORD_PAIRS = [
    ["Pomme", "Poire"], ["Chat", "Chien"], ["Avion", "Hélicoptère"],
    ["Boulangerie", "Pâtisserie"], ["Plage", "Piscine"], ["Livre", "Magazine"],
    ["Café", "Thé"], ["Ordinateur", "Tablette"], ["Lune", "Soleil"],
    ["Guitare", "Piano"], ["Football", "Rugby"], ["Pizza", "Burger"]["Voiture", "Vélo"],["Montagne", "Colline"],["École", "Université"],["Film", "Série"],["Chapeau", "Casquette"],["Fleur", "Arbre"],["Glace", "Sorbet"],["Stylo", "Crayon"],
["Miroir", "Vitre"],
["Roi", "Reine"],
["Bouteille", "Verre"],
["Train", "Bus"],
["Pomme de terre", "Carotte"],
["Lit", "Canapé"],
["Oiseau", "Poisson"],
["Chocolat", "Bonbon"],
["Téléphone", "Ordinateur"],
["Parapluie", "Imperméable"],
["Étoile", "Planète"],
["Pantalon", "Short"],
["Théâtre", "Cinéma"]
];

io.on('connection', (socket) => {
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

    socket.on('requestStart', (config) => {
        if (players.length < 3) return socket.emit('errorMsg', 'Il faut au moins 3 joueurs !');
        
        // Choix des mots
        const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
        
        // Distribution des rôles
        let roles = [];
        for(let i=0; i<config.uCount; i++) roles.push('undercover');
        if(config.whiteEnabled) roles.push('mr_white');
        while(roles.length < players.length) roles.push('citizen');
        
        // Mélange
        roles = roles.sort(() => Math.random() - 0.5);
        
        players.forEach((p, i) => {
            p.alive = true;
            p.role = roles[i];
            p.word = (p.role === 'undercover') ? pair[1] : (p.role === 'mr_white' ? '' : pair[0]);
            
            io.to(p.id).emit('gameStarted', { 
                role: p.role, 
                word: p.word,
                isNewGame: true 
            });
        });

        // Premier tour
        io.emit('updateTurn', { currentId: players[0].id, currentName: players[0].name });
    });

    socket.on('sendWord', (word) => {
        const p = players.find(player => player.id === socket.id);
        if(p) {
            io.emit('newWord', { name: p.name, word: word });
            // Tour suivant
            let idx = players.findIndex(pl => pl.id === socket.id);
            let nextIdx = (idx + 1) % players.length;
            // Chercher le prochain vivant
            while(!players[nextIdx].alive) {
                nextIdx = (nextIdx + 1) % players.length;
            }
            io.emit('updateTurn', { currentId: players[nextIdx].id, currentName: players[nextIdx].name });
        }
    });

    socket.on('startVotePhase', () => {
        votes = {}; // Reset des votes
        io.emit('votePhaseStarted', players.filter(p => p.alive));
    });

    socket.on('castVote', (targetId) => {
        const voter = players.find(p => p.id === socket.id);
        if(!voter || !voter.alive) return;
        
        // Enregistrer le vote
        votes[socket.id] = targetId;

        // Compter les vivants
        const alivePlayers = players.filter(p => p.alive);
        const votesCast = Object.keys(votes).length;

        // Envoyer la mise à jour de progression à tout le monde
        io.emit('voteUpdate', { count: votesCast, total: alivePlayers.length });

        // Si tout le monde a voté
        if(votesCast === alivePlayers.length) {
            tallyVotesAndEliminate();
        }
    });

    function tallyVotesAndEliminate() {
        let counts = {};
        Object.values(votes).forEach(id => {
            counts[id] = (counts[id] || 0) + 1;
        });

        // Trouver le max
        let maxVotes = 0;
        let eliminatedId = null;
        for(const [id, count] of Object.entries(counts)) {
            if(count > maxVotes) {
                maxVotes = count;
                eliminatedId = id;
            }
        }
        // (En cas d'égalité, ici on prend le premier trouvé, on pourrait améliorer ça)

        const victim = players.find(p => p.id === eliminatedId);
        if(victim) {
            victim.alive = false;
            
            // Vérifier Victoire
            const winner = checkWinCondition();
            
            io.emit('playerEliminated', {
                name: victim.name,
                role: victim.role,
                word: victim.word,
                winner: winner
            });
        }
    }

    function checkWinCondition() {
        const alive = players.filter(p => p.alive);
        const undercovers = alive.filter(p => p.role === 'undercover');
        const citizens = alive.filter(p => p.role === 'citizen');
        const mrWhite = alive.filter(p => p.role === 'mr_white');

        // Mr White gagne s'il reste seul ou en 1v1 (simplifié) - Ou conditions spécifiques
        // Ici règles standard simplifiées :
        
        // Si plus d'imposteurs (Undercover + White) -> Citoyens gagnent
        if(undercovers.length === 0 && mrWhite.length === 0) return 'citizens';

        // Si Imposteurs >= Citoyens -> Imposteurs gagnent (Undercover ou White)
        // (Note: Mr White a souvent une condition spéciale de "devinette", ici on simplifie en victoire d'équipe "Imposteurs")
        if(undercovers.length + mrWhite.length >= citizens.length) return 'undercover';

        return null; // Pas encore fini
    }

    socket.on('requestNextRound', () => {
        io.emit('nextRoundStarted');
        // Relancer le tour de parole
        const firstAlive = players.find(p => p.alive);
        if(firstAlive) {
            io.emit('updateTurn', { currentId: firstAlive.id, currentName: firstAlive.name });
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('lobbyUpdate', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
