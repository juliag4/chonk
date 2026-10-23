import express from 'express';
import path from 'path';
import {createServer} from 'http';
import {Server} from 'socket.io';
import GameState from './docs/src/GameState.js';


const PORT = process.env.PORT || 3000;
const app = express();
const server = createServer(app);

const io = new Server(server, {
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
    origin: "*",
    }
});

// Set static folder
app.use(express.static(path.join(import.meta.dirname, 'docs')));

// Start server
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

let gamestate = new GameState();
gamestate.generateFoodCollection();

// Function to reduce redundancy
const getPlayer = (socketId) => gamestate.players[socketId];

const isInvalidNumber = (val) => typeof val !== 'number' || !isFinite(val);

// Handle a socket connection request from web client
const connections = [null, null, null, null, null, null, null, null, null, null];

io.on('connection', socket => {
    // Find an available player number
    let playerIndex = -1;
    for(const i in connections){
        if(connections[i] === null){
            playerIndex = i;
            break;
        }
    }
    
    if(playerIndex === -1){ return; }
    
    
    
    // Tell client what player number has connected
//    socket.emit('player-number', playerIndex);
//    console.log(`Player ${playerIndex} has connected`);
    
    connections[playerIndex] = true;
    
    socket.on('join', (playerName) => {
        socket.join('Room 1');
        console.log(`Adding player ${playerIndex}`);
        gamestate.addPlayer(socket.id);
        
        const player = getPlayer(socket.id);
        if(playerName.trim().length > 0){
            // Ensures player's name doesn't exceed 15 characters
            player.name = playerName.trim().substring(0, 15);
        }
    });
    
    /*socket.on('player-name', (playerName) => {
        const player = getPlayer(socket.id);
        if(!player) { return; }
        
        if(playerName.trim().length > 0){
            // Ensures player's name doesn't exceed 15 characters
            player.name = playerName.trim().substring(0, 15);
        }
    });*/
    
    socket.on('mouse-move', (mouseX, mouseY, canvasWidth, canvasHeight) => {
        const player = getPlayer(socket.id);
        if(!player) { return; }
        
        if ([mouseX, mouseY, canvasWidth, canvasHeight].some(isInvalidNumber)) { return; }
        
        player.mouseX = mouseX;
        player.mouseY = mouseY;
        
        player.calculateMoves(mouseX, mouseY);
        player.calculateView(canvasWidth, canvasHeight);
        player.adjustView(canvasWidth, canvasHeight, gamestate.mapWidth, gamestate.mapHeight);
    });
    
    socket.on('player-radius-update', (playerInput, id) => {
        const player = getPlayer(id);
        if(!player){ return; }
        
        player.targetRadius = playerInput.radius;
        player.radius = playerInput.radius;
    });
    
    socket.on('food-update', (foodCollection) => {
        gamestate.foodCollection = foodCollection;
    });
    
    socket.on('collision-update', (largePlayerId, smallPlayerId, smallPlayerArea) => {
        if(!getPlayer(smallPlayerId)){ return; }
        
        // if the smaller player hasn't been deleted, delete it and update the larger player's radius
        gamestate.deletePlayer(smallPlayerId);
        
        const player = getPlayer(largePlayerId);
        
        const newPlayerArea = (Math.PI * (player.targetRadius * player.targetRadius)) + smallPlayerArea;
        const newPlayerRadius = Math.sqrt(newPlayerArea / Math.PI);
        
        if(player.targetRadius !== newPlayerRadius){
            player.targetRadius = newPlayerRadius;
            player.radius = Math.round(newPlayerRadius);
        }
    });

    socket.on('game-over', () => {
        if(!connections[playerIndex]){ return; }
        
        console.log(`Removing player ${playerIndex}`);
        connections[playerIndex] = null;
        gamestate.deletePlayer(socket.id);
        
        const allNull = connections.every(element => element === null);
        if(allNull){ gamestate.generateFoodCollection(); }
    });
    
    socket.on('disconnect', () => {
        if(!connections[playerIndex]){ return; }
        
        console.log(`Removing player ${playerIndex}`);
        connections[playerIndex] = null;
        gamestate.deletePlayer(socket.id);
        
        const allNull = connections.every(element => element === null);
        if(allNull){ gamestate.generateFoodCollection(); }
    });
    
    setInterval(() => {
        socket.emit('state', {players: gamestate.players, food: gamestate.foodCollection, id: socket.id});
    }, 50);
});
