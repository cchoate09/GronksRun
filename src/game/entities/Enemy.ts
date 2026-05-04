import { Body } from '../../engine/physics';
import { Container, Graphics } from 'pixi.js';
import { SkeletalSprite } from './SkeletalSprite';
import { ENEMY_SHEETS } from '../assets/spriteData';

export class Projectile {
    public body: Body;
    public view: Graphics;
    public isDead: boolean = false;

    constructor(x: number, y: number, vx: number, vy: number, color: number = 0xffff00) {
        this.body = new Body();
        this.body.x = x;
        this.body.y = y;
        this.body.w = 10;
        this.body.h = 10;
        this.body.vx = vx;
        this.body.vy = vy;
        this.body.gravityScale = 0.2; // Slow falling projectiles

        this.view = new Graphics();
        this.view.circle(5, 5, 5).fill(color);
    }

    public update(dt: number): void {
        if (this.body.onGround || this.body.x < -100 || this.body.x > window.innerWidth + 100) {
            this.isDead = true;
        }
    }
}

export class Enemy {
    public body: Body;
    public view: Container;
    public sprite: SkeletalSprite;
    public hpBar: Graphics;

    public hp: number = 50;
    public maxHp: number = 50;
    protected speed: number = 150;
    public isHit: boolean = false;
    protected hitTimer: number = 0;
    public isDead: boolean = false;
    protected facingRight: boolean = false;
    
    public type: 'CHASER' | 'RANGED' | 'HEAVY' | 'SERPENT' = 'CHASER';

    constructor(x: number, y: number, type: 'CHASER' | 'RANGED' | 'HEAVY' | 'SERPENT' = 'CHASER') {
        this.type = type;
        this.body = new Body();
        this.body.w = 50;
        this.body.h = 60;
        this.body.x = x;
        this.body.y = y;
        
        this.view = new Container();
        this.sprite = new SkeletalSprite(0xff4444, ENEMY_SHEETS[type]);
        this.view.addChild(this.sprite);

        this.hpBar = new Graphics();
        this.view.addChild(this.hpBar);
        this.drawHpBar();
    }

    protected drawHpBar(): void {
        this.hpBar.clear();
        if (this.hp < this.maxHp) {
            this.hpBar.rect(0, -15, 50, 6).fill(0x333333);
            this.hpBar.rect(0, -15, 50 * (this.hp / this.maxHp), 6).fill(0xff0000);
        }
    }

    public update(dt: number, targetX: number): void {
        if (this.isDead) return;

        if (this.isHit) {
            this.hitTimer -= dt;
            if (this.hitTimer <= 0) {
                this.isHit = false;
                this.drawHpBar();
            }
            this.sprite.setState('HIT');
            this.sprite.tint = 0xffffff;
        } else {
            this.sprite.tint = 0xffffff;
            this.aiLogic(dt, targetX);
        }

        this.sprite.update(dt, Math.abs(this.body.vx) / 100 || 1);
        this.sprite.scale.x = this.facingRight ? 1 : -1;
        this.sprite.x = this.facingRight ? 0 : this.body.w;
    }

    protected aiLogic(dt: number, targetX: number): void {
        const dx = targetX - this.body.x;
        if (Math.abs(dx) > 460) {
            this.body.vx = 0;
            this.facingRight = dx > 0;
            this.sprite.setState('IDLE');
        } else if (Math.abs(dx) > 112) {
            this.body.vx = Math.sign(dx) * this.speed;
            this.facingRight = dx > 0;
            this.sprite.setState('RUN');
        } else {
            this.body.vx = 0;
            this.sprite.setState('IDLE');
        }
    }

    public takeDamage(amount: number, knockbackDir: number): void {
        if (this.isDead) return;

        this.hp -= amount;
        this.isHit = true;
        this.hitTimer = 0.2;
        
        this.body.vx = knockbackDir * 500;
        this.body.vy = -200;
        this.body.onGround = false;

        this.drawHpBar();

        if (this.hp <= 0) {
            this.isDead = true;
        }
    }

    public render(): void {
        if (this.isDead) {
            this.view.visible = false;
            return;
        }
        this.view.position.set(this.body.x, this.body.y);
    }
}

export class RangedEnemy extends Enemy {
    private shootTimer: number = 0;
    private shootCooldown: number = 2.0;

    constructor(x: number, y: number) {
        super(x, y, 'RANGED');
        this.type = 'RANGED';
        this.sprite.tint = 0x44ff44;
        this.speed = 100;
    }

    protected aiLogic(dt: number, targetX: number): void {
        const dx = targetX - this.body.x;
        const dist = Math.abs(dx);

        if (dist > 560) {
            this.body.vx = 0;
            this.facingRight = dx > 0;
            this.sprite.setState('IDLE');
        } else if (dist > 400) {
            this.body.vx = Math.sign(dx) * this.speed;
            this.facingRight = dx > 0;
            this.sprite.setState('RUN');
        } else if (dist < 250) {
            this.body.vx = -Math.sign(dx) * this.speed;
            this.facingRight = dx > 0;
            this.sprite.setState('RUN');
        } else {
            this.body.vx = 0;
            this.facingRight = dx > 0;
            this.sprite.setState('IDLE');
            
            this.shootTimer += dt;
            if (this.shootTimer >= this.shootCooldown) {
                this.shootTimer = 0;
                this.sprite.setState('ATTACK');
                // Scene will handle spawning projectile
                (this as any).pendingShot = true;
            }
        }
    }
}

export class HeavyEnemy extends Enemy {
    constructor(x: number, y: number) {
        super(x, y, 'HEAVY');
        this.type = 'HEAVY';
        this.maxHp = 150;
        this.hp = 150;
        this.speed = 80;
        this.body.w = 70;
        this.body.h = 90;
        this.sprite.scale.set(1.5);
        this.sprite.tint = 0xff8844;
        this.drawHpBar();
    }
    
    protected drawHpBar(): void {
        this.hpBar.clear();
        if (this.hp < this.maxHp) {
            this.hpBar.rect(0, -20, 70, 8).fill(0x333333);
            this.hpBar.rect(0, -20, 70 * (this.hp / this.maxHp), 8).fill(0xff0000);
        }
    }

    public takeDamage(amount: number, knockbackDir: number): void {
        // Heavy armor: reduced knockback
        super.takeDamage(amount, knockbackDir * 0.3);
    }
}
