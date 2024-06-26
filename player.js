class Player {
    constructor(sprite, id, name, container) {
        this.horizontal; // Is left or right down
        this.jump; // Have they pressed jump
        this.container = container;
        this.sprite = sprite;
        this.id = id;
        this.name = name;
        this.position = this.container.position;
        this.velocity = {
            x: 0,
            y: 0
        }

        this.jumps = 0;
        this.grounded = false;

        // Customisables
        this.acceleration = 4;
        this.maxSpeed = 1.5;
        this.maxJumps = 2;
    }

    update(delta, map, origin) {
        // Max speed
        let dif = Math.abs((Math.abs(this.velocity.x) - Math.abs(this.maxSpeed)) * 2 * delta);
        
        if (this.velocity.x - dif >= this.maxSpeed) {
            this.velocity.x -= dif;
        }
        else if (this.velocity.x + dif <= -this.maxSpeed) {
            this.velocity.x += dif;
        }

        // Make zero when small to avoid underflow
        if (Math.abs(this.velocity.x) < 1e-10) {
            this.velocity.x = 0;
        }

        this.grounded = false;

        // Gravity
        if (this.velocity.y < this.acceleration*2) {
            this.velocity.y -= 0.2*delta;
        }

        // Apply velocities
        this.position.x += delta*this.acceleration*this.velocity.x;
        this.position.y -= delta*this.acceleration*this.velocity.y;

        // If too low
        if (this.position.y > 1000) {
            this.position.y = origin.y - 200;
            this.position.x = origin.x - this.sprite.getBounds().width/2;
            this.velocity.y = 0;
            console.log("Respawning player ID:", this.id, this.velocity, this.position);
        }

        // Check if each platform intersects
        for (let i = 0; i < map.length; i++) {
            if (this.checkCollision(this.sprite, map[i])) {
                var xDepth, yDepth;
                var top, right;

                this.grounded = true;
                this.jumps = this.maxJumps;

                if (this.position.x > map[i].position.x) {
                    // Right
                    right = true;
                    xDepth = Math.abs(map[i].getBounds().maxX - this.sprite.getBounds().minX);
                }
                else {
                    // Left
                    right = false;
                    xDepth = Math.abs(this.sprite.getBounds().maxX - map[i].getBounds().minX);
                }
                if (this.position.y > map[i].position.y) {
                    // Bottom
                    top = false;
                    yDepth = Math.abs(map[i].getBounds().maxY - this.sprite.getBounds().minY);
                }
                else {
                    // Top
                    top = true;
                    yDepth = Math.abs(this.sprite.getBounds().maxY - map[i].getBounds().minY);
                }

                // Collisions on y
                // If deeper in x than y then must be vertical
                if (xDepth > yDepth) {
                    // On the top
                    if (top) {
                        this.position.y -= yDepth;

                        // Stop y speed
                        if (this.velocity.y < 0) {
                            this.velocity.y = 0;   
                        }
                    }
                    // On the bottom
                    else {
                        this.position.y += yDepth;
                        this.jumps = 0;

                        // Stop y speed
                        if (this.velocity.y > 0) {
                            this.velocity.y = 0;   
                        }
                    }
                } 

                // Collisions on x
                else {
                    // On the right
                    if (right) {
                        this.position.x += xDepth;
                        this.velocity.x = 0;
                    }
                    // On the left
                    else {
                        this.position.x -= xDepth;
                        this.velocity.x = 0;
                    }

                    // Slow down fall
                    if (this.velocity.y < 0) {
                        this.velocity.y /= (1 + delta);
                    }
                }
            }
        }
    }

    checkCollision(object1, object2) {
        const bounds1 = object1.getBounds();
        const bounds2 = object2.getBounds();

        return (
            bounds1.x < bounds2.x + bounds2.width
            && bounds1.x + bounds1.width > bounds2.x
            && bounds1.y < bounds2.y + bounds2.height
            && bounds1.y + bounds1.height > bounds2.y
        );
    }
}

export default Player;