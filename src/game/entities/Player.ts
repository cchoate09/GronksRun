import { Body } from '../../engine/physics';
import { Container } from 'pixi.js';
import { InputManager } from '../../engine/input';
import { SkeletalSprite } from './SkeletalSprite';
import { HERO_SHEETS } from '../assets/spriteData';

export class Player {
    public body: Body;
    public view: Container;
    public sprite: SkeletalSprite;

    private speed: number = 500;
    private jumpForce: number = -850;
    private dashForce: number = 1200;
    public isDashing: boolean = false;
    private dashTimer: number = 0;
    public hp: number = 100;
    public isHit: boolean = false;
    private hitTimer: number = 0;
    public facingRight: boolean = true;
    public isAttacking: boolean = false;
    private attackTimer: number = 0;
    public attackId: number = 0;
    public attackRange: number = 190;

    constructor() {
        this.body = new Body();
        this.body.w = 40;
        this.body.h = 80;
        this.body.x = 100;
        this.body.y = 100;

        this.view = new Container();
        this.sprite = new SkeletalSprite(0x4488ff, HERO_SHEETS.gronk);
        this.view.addChild(this.sprite);
    }

    public takeDamage(amount: number, knockbackDir: number): void {
        if (this.isHit) return;
        this.hp -= amount;
        this.isHit = true;
        this.hitTimer = 0.5;
        this.body.vx = knockbackDir * 600;
        this.body.vy = -400;
        this.body.onGround = false;

        if (this.hp < 0) this.hp = 0;
    }

    public update(dt: number, input: InputManager): void {
        if (this.isHit) {
            this.hitTimer -= dt;
            if (this.hitTimer <= 0) {
                this.isHit = false;
                this.sprite.tint = 0xffffff;
            } else {
                this.sprite.tint = 0xff8888; // Red tint when hit
            }
        }

        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            } else {
                this.body.vy = 0; // Freeze vertical movement during dash
                this.clampToScreen();
                return; // Skip normal input processing
            }
        }

        if (this.isAttacking) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
            }
        }

        // Horizontal movement
        if (input.isDown('ArrowLeft') || input.isDown('KeyA')) {
            this.body.vx = -this.speed;
            this.facingRight = false;
        } else if (input.isDown('ArrowRight') || input.isDown('KeyD')) {
            this.body.vx = this.speed;
            this.facingRight = true;
        } else {
            this.body.vx = 0;
        }

        // Jumping
        if ((input.justPressed('ArrowUp') || input.justPressed('KeyW') || input.actionJustPressed('jump')) && this.body.onGround) {
            this.body.vy = this.jumpForce;
            this.body.onGround = false;
        }

        // Dashing
        if (input.justPressed('ShiftLeft') || input.justPressed('KeyE') || input.actionJustPressed('dash')) {
            this.isDashing = true;
            this.dashTimer = 0.2;
            this.body.vx = this.facingRight ? this.dashForce : -this.dashForce;
            this.attackId++;
        }

        // Attacking
        if (input.justPressed('Space') || input.justPressed('KeyJ') || input.justPressed('KeyF') || input.justPressed('Enter') || input.actionJustPressed('attack')) {
             if (!this.isAttacking) {
                 this.isAttacking = true;
                 this.attackTimer = 0.34;
                 this.attackId++;
             }
        }

        // State update for animation
        if (this.isAttacking) {
            this.sprite.setState('ATTACK');
        } else if (this.isHit) {
            this.sprite.setState('HIT');
        } else if (Math.abs(this.body.vx) > 10) {
            this.sprite.setState('RUN');
        } else {
            this.sprite.setState('IDLE');
        }

        this.sprite.update(dt, Math.abs(this.body.vx) / 200 || 1);
        this.sprite.scale.x = this.facingRight ? 1 : -1;
        // Adjust pivot for flipping
        this.sprite.x = this.facingRight ? 0 : this.body.w;

        // Screen bounds logic (clamp instead of wrap for a room-based feel)
        this.clampToScreen();
    }

    public render(): void {
        this.view.position.set(this.body.x, this.body.y);
    }

    private clampToScreen(): void {
        if (this.body.x < 0) {
            this.body.x = 0;
            if (this.body.vx < 0) this.body.vx = 0;
        }
        if (this.body.x > window.innerWidth - this.body.w) {
            this.body.x = window.innerWidth - this.body.w;
            if (this.body.vx > 0) this.body.vx = 0;
        }
    }
}
