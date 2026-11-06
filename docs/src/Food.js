export default class Food {
    constructor(id, x, y, radius, color){
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.area = Math.round(Math.PI * (this.radius * this.radius));
        this.color = color;
        this.isConsumed = false;
    }
}
