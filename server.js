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
        origin: "https://chonk-online.onrender.com",
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true
});

// Set static folder
app.use(express.static(path.join(import.meta.dirname, 'docs')));

// Start server
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

let gamestate = new GameState();
gamestate.generateFoodCollection();

// Initial Foods
const foodArray = gamestate.foodCollection.foods;

// Function to reduce redundancy
const getPlayer = (socketId) => gamestate.players[socketId];

const isInvalidNumber = (val) => typeof val !== 'number' || !isFinite(val);

// Handle a socket connection request from web client
const connections = [null, null, null, null, null, null, null, null, null, null];

let serverGameLoop = null;
function startServerInterval() {
    if(serverGameLoop === null) {
        console.log('Starting the global game loop...');
        serverGameLoop = setInterval(() => {
            io.emit('state', { players: gamestate.players });
        }, 50);
    }
}

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
    
    startServerInterval();
    
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
        socket.emit('player-id', {id: socket.id});
        
        const activeFood = foodArray.filter(f => !f.isConsumed);
        socket.emit('initial-map-state', { food: activeFood });
    });
      
    socket.on('eat-food', (data) => {
        // Remove it from server memory array
        gamestate.foodCollection.foods = gamestate.foodCollection.foods.filter(f => f.id !== data.foodId);
        // Tell everyone to delete this food
        io.emit('food-eaten', { id: data.id });
    });
    
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
        
        if(Object.keys(gamestate.players).length === 0 && serverGameLoop !== null) {
            console.log("No players left. Putting game loop to sleep.");
            clearInterval(serverGameLoop);
            serverGameLoop = null;
        }
        
        const allNull = connections.every(element => element === null);
        if(allNull){ gamestate.generateFoodCollection(); }
    });
    
    socket.on('disconnect', (reason) => {
        console.log(`Tab Killed: ${socket.id} | Reason: ${reason}`);
        
        if(!connections[playerIndex]){ return; }
        
        console.log(`Removing player ${playerIndex}`);
        connections[playerIndex] = null;
        gamestate.deletePlayer(socket.id);
        
        if(Object.keys(gamestate.players).length === 0 && serverGameLoop !== null) {
            console.log("No players left. Putting game loop to sleep.");
            clearInterval(serverGameLoop);
            serverGameLoop = null;
        }
        
        const allNull = connections.every(element => element === null);
        if(allNull){ gamestate.generateFoodCollection(); }
    });
});
