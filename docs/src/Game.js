import {AddStyle} from './Styles.js';
import GameState from './GameState.js';

AddStyle(`
    body{
        margin: 0;
    }

    game-core{
        display: flex;
        font-family: sans-serif;
        width: 100vw;
        height: 100vh;
    }

    canvas{
        background-color: lightblue;
        object-fit: contain;
    }
`);

const fontSettings = {
  family: "sans-serif",
  size: 100,
  sizeAndFamily: "100px sans-serif"
};

const ascendingPlayerIds = [];
const playerStates = [];

const socket = io({
    transports: ['websocket']
});

let gameController = null;

export default class Game extends HTMLElement{
    constructor(){
        super();
        
        this.innerHTML = `
            <canvas></canvas>
        `;
        
        this.canvas = this.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d');
                
        this.gameState = new GameState();

        this.gameUpdate = this.gameUpdate.bind(this);
    }
    
    startSinglePlayerGame(){
        // TODO: remove event listeners
        this.gameState.playerId = '1';
        
        this.gameState.addPlayer('1');
        const playerName = document.querySelector('.username').value;
        if(playerName.trim().length > 0){
            this.gameState.players['1'].name = playerName.trim().substring(0, 15);
        }
        
        const player = this.gameState.players['1'];
        
        this.canvas.addEventListener('mousemove', (e) => {
            player.mouseX = e.clientX;
            player.mouseY = e.clientY;
            
            player.calculateMoves(e.clientX, e.clientY);
            player.calculateView(this.canvas.width, this.canvas.height);
            player.adjustView(this.canvas.width, this.canvas.height, this.gameState.mapWidth, this.gameState.mapHeight);
        });
        
        this.addEventListener('gameOver', () => {
            this.gameState.deletePlayer('1');
        });
        
        this.gameState.generateFoodCollection();
        
        requestAnimationFrame(this.gameUpdate);
    }
    
    startMultiplayerGame(){
        if(gameController){ gameController.abort(); }
            
        gameController = new AbortController();
        const { signal } = gameController;
        
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        let playerNum = 0;
        
        /*if(socket && socket.connected) {
            console.log("Socket already exists");
            return;
        }
        socket = io({
            transports: ["websocket"] 
        });*/
        console.log('Starting multiplayer game');
                
        socket.emit('join', document.querySelector('.username').value);
        
        //socket.emit('player-name', document.querySelector('.username').value);

        
        // Get your player number
        /*socket.on('player-number', num => {
            console.log('player-number socket');
            if(num === -1){
                console.log('Sorry the server is full');
            }else{
                playerNum = parseInt(num);
                socket.emit('join');
                console.log(`Player number ${num} has connected or disconnected`);
                
                socket.emit('player-name', document.querySelector('.username').value);
            }
        });*/
        socket.off('state');
                
        socket.on('state', ({players, food, id}) => {
            this.gameState.playerId = String(id);
            this.gameState.updateState(players, food);
        });
                
        // Event listeners that will emit events so the gamestate object in the server is updated
        
        this.canvas.addEventListener('mousemove', (e) => {
            socket.emit('mouse-move', e.clientX, e.clientY, this.canvas.width, this.canvas.height);
        }, { signal });
        
        this.addEventListener('gameOver', () => {
            socket.emit('game-over');
        }, { signal });
        
        this.addEventListener('playerRadiusUpdate', (e) => {
            socket.emit('player-radius-update', this.gameState.players[e.detail.id], e.detail.id);
        }, { signal });
        
        this.addEventListener('foodUpdate', () => {
            socket.emit('food-update', this.gameState.foodCollection);
        }, { signal });
        
        this.addEventListener('fullPlayerOverlap', (e) => {
            socket.emit('collision-update', e.detail.largePlayerId, e.detail.smallPlayerId, e.detail.smallPlayerArea);
        }, { signal });
        
        requestAnimationFrame(this.gameUpdate);
    };
        
    gameUpdate(currentTime){
        ascendingPlayerIds.length = 0;
        playerStates.length = 0;
        
        if(!this.gameState || !this.gameState.players) {
            requestAnimationFrame(this.gameUpdate);
            return;
        }
        
        const players = this.gameState.players;
        console.log("Players in memory on this tab:", Object.keys(this.gameState.players).length);
    
        for(const id in players){
            if(Object.hasOwn(players, id)){
                ascendingPlayerIds.push(id);
                playerStates.push(true);
            }
        }
        ascendingPlayerIds.sort((id1, id2) => {
            return players[id1].radius - players[id2].radius;
        });
        
        const isNotEmpty = Object.keys(players).length > 0;
        if(isNotEmpty && this.gameState.playerId){
            const player = this.gameState.players[this.gameState.playerId];
            if(!player){
                this.finishGame(player);
                return;
            }
            
            const hasCrossedRight = player.x > (this.gameState.mapWidth - this.gameState.borderThickness) - player.radius;
            const hasCrossedLeft = player.x < this.gameState.borderThickness + player.radius;
            const hasCrossedBottom = player.y > (this.gameState.mapHeight - this.gameState.borderThickness) - player.radius;
            const hasCrossedTop = player.y < this.gameState.borderThickness + player.radius;
            
            const playerDead = hasCrossedRight || hasCrossedLeft || hasCrossedBottom || hasCrossedTop;
            if(playerDead){
                this.finishGame(player);
                return;
            }
            
            for(const [index, food] of this.gameState.foodCollection.foods.entries()){
                // Don't do anything if food has already been eaten by player
                if(food.isConsumed){ continue; }
                // Checks full overlap between player and food to determine if player eats food
                const foodIsConsumed = this.checkFullOverlap(player, food);
                
                if(foodIsConsumed){
                    this.gameState.foodCollection.foods[index].isConsumed = true;
                    // Dispatches event so the food collection in server is updated
                    this.dispatchEvent(new Event('foodUpdate', { bubbles: true }));
                    // Calculates new player area and then updates player radius if changed
                    this.updatePlayerRadius(player, food.area);
                }
            }
            
            const playerArea = (Math.PI * (player.targetRadius * player.targetRadius));
            
            for(let index = 0; index < ascendingPlayerIds.length; index++){
                // Remove this check if unneeded
                if(!playerStates[index]){ continue; }
                
                const currentId = ascendingPlayerIds[index];
                const opponent = this.gameState.players[currentId];
                if(opponent.id === this.gameState.playerId){ continue; }
                
                const opponentArea = (Math.PI * (opponent.targetRadius * opponent.targetRadius));
                // Figure out how to update player radius when opponent runs into players if not already
                if(opponentArea * 1.25 <= playerArea && this.checkFullPlayerOverlap(opponent, player)){
                    delete this.gameState.players[currentId];
                    playerStates[index] = false;
                    
                    // Processes to the server so everything gets updated exactly once
                    const fullPlayerOverlapEvent = new CustomEvent('fullPlayerOverlap', {
                        bubbles: true,
                        detail: { largePlayerId: this.gameState.playerId, smallPlayerId: currentId, smallPlayerArea: opponentArea }
                    });
                    this.dispatchEvent(fullPlayerOverlapEvent);
                }
                if(playerArea * 1.25 <= opponentArea && this.checkFullPlayerOverlap(player, opponent)){
                    // Processes to the server so everything gets updated exactly once
                    const fullPlayerOverlapEvent = new CustomEvent('fullPlayerOverlap', {
                        bubbles: true,
                        detail: { largePlayerId: currentId, smallPlayerId: this.gameState.playerId, smallPlayerArea: playerArea }
                    });
                    this.dispatchEvent(fullPlayerOverlapEvent);
                    this.finishGame(player);
                    return;
                }
            }
            this.translateContext(player.view);
            this.redraw();
        }

        requestAnimationFrame(this.gameUpdate);
    }
    
    translateContext(view){
        // Undo the transform
        this.ctx.resetTransform();
        
        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
                
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Move the view window
        this.ctx.translate(-view.x, -view.y);
    }
    
    redraw(){
        // Aligning the text
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Border drawing
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = this.gameState.borderThickness;
        // Fits the whole border inside of our current map
        this.ctx.strokeRect(this.ctx.lineWidth / 2,
                            this.ctx.lineWidth / 2,
                            this.gameState.mapWidth - this.ctx.lineWidth,
                            this.gameState.mapHeight - this.ctx.lineWidth);
        
        for(const food of this.gameState.foodCollection.foods){
            // Styling of the food circle itself
            if(food.isConsumed){ continue; }
            this.ctx.beginPath();
            this.ctx.arc(food.x, food.y, food.radius, 0, 2 * Math.PI);
            this.ctx.fillStyle = food.color;
            this.ctx.fill();
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.closePath();
        }
        
        // Draws players from smallest radius to largest so larger players appear on top of smaller players
        for(let i = 0; i < ascendingPlayerIds.length; i++){
            if(!playerStates[i]){ continue; }
            
            const currentId = ascendingPlayerIds[i];
            const player = this.gameState.players[currentId];

            // Styling of the player circle itself
            this.ctx.beginPath();
            this.ctx.arc(player.x, player.y, player.radius, 0, 2 * Math.PI);
            this.ctx.fillStyle = player.color;
            this.ctx.fill();
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.closePath();
            
            // Styling / calculations for name within the circle
            
            this.ctx.font = fontSettings.sizeAndFamily;
            // Width at the initial font size
            const initialLineWidth = this.ctx.measureText(player.name).width;

            // Multiplies ratio (target width / initiallineWidth) by initial font size to calculate font size
            const calculatedFontSize = (((player.radius * 2) - 8) / initialLineWidth) * fontSettings.size;
            // Ensures font size is at least the minimum size
            const finalFontSize = Math.max(calculatedFontSize, this.gameState.minFontSize);
            
            // Styling and color of the text
            this.ctx.font = `${finalFontSize}px ${fontSettings.family}`;
            this.ctx.fillStyle = player.textColor;
            
            // Draw's text based on player's name input
            this.ctx.fillText(player.name, player.x, player.y);
        }
        
    };
    
    // checks if food is entirely within player's boundaries
    // returns true if food is consumed, false otherwise
    checkFullOverlap(player, food){
        const rightOverlap = food.x + food.radius <= player.x + player.radius;
        const leftOverlap = food.x - food.radius >= player.x - player.radius;
        const bottomOverlap = food.y + food.radius <= player.y + player.radius;
        const topOverlap = food.y - food.radius >= player.y - player.radius;
        return rightOverlap && leftOverlap && bottomOverlap && topOverlap;
    }
    
    // checks if smaller player is entirely within larger player's boundaries
    // returns true if smaller player is consumed, false otherwise
    checkFullPlayerOverlap(smallerPlayer, largerPlayer){
        const rightOverlap = smallerPlayer.x + smallerPlayer.radius <= largerPlayer.x + largerPlayer.radius;
        const leftOverlap = smallerPlayer.x - smallerPlayer.radius >= largerPlayer.x - largerPlayer.radius;
        const bottomOverlap = smallerPlayer.y + smallerPlayer.radius <= largerPlayer.y + largerPlayer.radius;
        const topOverlap = smallerPlayer.y - smallerPlayer.radius >= largerPlayer.y - largerPlayer.radius;
        return rightOverlap && leftOverlap && bottomOverlap && topOverlap;
    }
    
    // increase player area size by specified amount and then adjust player radius accordingly
    updatePlayerRadius(player, area){
        const newPlayerArea = (Math.PI * (player.targetRadius * player.targetRadius)) + area;
        const newPlayerRadius = Math.sqrt(newPlayerArea / Math.PI);
        
        if(player.targetRadius !== newPlayerRadius){
            player.targetRadius = newPlayerRadius;
            player.radius = Math.round(newPlayerRadius);
            // Dispatches event so the the player's target radius and radius in server are updated
            const playerRadiusEvent = new CustomEvent('playerRadiusUpdate', {
                bubbles: true,
                detail: { id: player.id }
            });
            this.dispatchEvent(playerRadiusEvent);
        }
    }
    
    // ends the player's game and takes them back to the starting page
    finishGame(player){
        if(player){
            player.maxSpeed = 3;
            player.view = {x: 0, y: 0};
        }
        
        if(gameController) {
            gameController.abort();
            gameController = null;
        }
        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        const gameOverEvent = new CustomEvent('gameOver', { bubbles: true });
        this.dispatchEvent(gameOverEvent);
    }
}
customElements.define('game-core', Game);
