import Food from './Food.js';

export default class FoodCollection {
    constructor(){
        this.foods = [];
    }
    
    addFood(id, x, y, radius, color){
        this.foods.push(new Food(id, x, y, radius, color));
    }
}
