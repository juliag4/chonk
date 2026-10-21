import Player from './Player.js';
import FoodCollection from './FoodCollection.js';

export default class GameState{
    constructor(){
        this.mapWidth = 3000;
        this.mapHeight = 3000;
        this.borderThickness = 40;
        this.initialPlayerRadius = 20;

        this.players = {};
        this.playerId = null;
        
        this.foodCollection = new FoodCollection();
        this.initialFoodCount = (this.mapWidth * this.mapHeight) / 10000;
        this.foodRadius = 10;
        
        // min font size for player name
        this.minFontSize = 8;
    };
    
    updateState(players, foodCollection){
        this.players = players;
        this.foodCollection = foodCollection;
    }
    
    addPlayer(id){
        const positionMultiplier = (this.mapWidth - this.initialPlayerRadius -
                                    this.borderThickness) - this.initialPlayerRadius - this.borderThickness;
        const xPos = Math.floor(Math.random() * (positionMultiplier)) + this.initialPlayerRadius + this.borderThickness;
        const yPos = Math.floor(Math.random() * (positionMultiplier)) + this.initialPlayerRadius + this.borderThickness;
        const color = this.getRandomRGB();
        const textColor = this.getTextColor(color);
        
        this.players[String(id)] = new Player(String(id), xPos, yPos, this.initialPlayerRadius, color, textColor);
    }
    
    deletePlayer(id){
        delete this.players[String(id)];
    }
    
    getRandomRGB(){
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    getTextColor(color){
        // regex matches any digit one or more times for all instances
        // ensures that parseInt parses the color into base 10
        const [r, g, b] = color.match(/\d+/g).map(rgb => parseInt(rgb, 10));
          
        // calculate YIQ brightness score (the color space used by the analog NTSC color TV system)
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

        // if color is bright, use black text. otherwise use white text
        return yiq >= 128 ? '#000000' : '#ffffff';
    }
    
    getPlayerId(){
        return this.players[this.playerId] || null;
    }
        
    generateFoodCollection(){
        this.foodCollection = new FoodCollection();
        for(let i = 0; i < this.initialFoodCount; i++){
            const positionMultiplier = (this.mapWidth - this.foodRadius - this.borderThickness) - this.foodRadius - this.borderThickness;
            const xPos = Math.floor(Math.random() * (positionMultiplier)) + this.foodRadius + this.borderThickness;
            const yPos = Math.floor(Math.random() * (positionMultiplier)) + this.foodRadius + this.borderThickness;
            const color = this.getRandomRGB();
            this.foodCollection.addFood(xPos, yPos, this.foodRadius, color);
        }
    }
};
