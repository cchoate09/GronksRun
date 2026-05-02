import { Body } from '../../engine/physics';
import { Graphics, Container } from 'pixi.js';

export class Enemy {
    public body: Body;
    public view: Container;
    public graphics: Graphics;

    public hp: number = 50;
    private speed: number = 150;
    public isHit: boolean = false;
    private hitTimer: number = 0;
    public isDead: boolean = false;

    constructor(x: number, y: number) {
        this.body = new Body();
        this.body.w = 50;
        this.body.h = 50;
        this.body.x = x;
        this.body.y = y;
        
        this.view = new Container();
        this.graphics = new Graphics();
        this.view.addChild(this.graphics);
    }

    public update(dt: number, targetX: number): void {
        if (this.isDead) return;

        if (this.isHit) {
            this.hitTimer -= dt;
            if (this.hitTimer <= 0) {
                this.isHit = false;
            }
            return; // Stunned while hit
        }

        // Simple AI: Move towards target
        const dx = targetX - this.body.x;
        if (Math.abs(dx) > 10) {
            this.body.vx = Math.sign(dx) * this.speed;
        } else {
            this.body.vx = 0;
        }
    }

    public takeDamage(amount: number, knockbackDir: number): void {
        if (this.isDead) return;

        this.hp -= amount;
        this.isHit = true;
        this.hitTimer = 0.3;
        
        // Physics knockback
        this.body.vx = knockbackDir * 600;
        this.body.vy = -300;
        this.body.onGround = false;

        if (this.hp <= 0) {
            this.isDead = true;
        }
    }

    public render(): void {
        if (this.isDead) {
            this.view.visible = false;
            return;
        }

        this.graphics.clear();
        this.graphics.rect(0, 0, this.body.w, this.body.h).fill(this.isHit ? 0xffffff : 0xff3333);
        this.view.position.set(this.body.x, this.body.y);
    }
}
