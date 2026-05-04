import { Body } from '../../engine/physics';
import { Container, Graphics } from 'pixi.js';
import { InputManager } from '../../engine/input';
import { SkeletalSprite } from './SkeletalSprite';
import { HERO_SHEETS } from '../assets/spriteData';

export type AttackMode = 'NONE' | 'MELEE' | 'RANGED';
export type AttackPhase = 'NONE' | 'WINDUP' | 'ACTIVE' | 'RECOVERY';

export class Player {
    public body: Body;
    public view: Container;
    public sprite: SkeletalSprite;
    private slash: Graphics;

    private speed: number = 660;
    private acceleration: number = 3300;
    private deceleration: number = 3600;
    private airControl: number = 0.5;
    private airSpeedMultiplier: number = 0.68;
    private jumpForce: number = -760;
    public isDashing: boolean = false;
    public isPounding: boolean = false;
    public isCrouching: boolean = false;
    public hp: number = 100;
    public isHit: boolean = false;
    private hitTimer: number = 0;
    public facingRight: boolean = true;
    public isAttacking: boolean = false;
    private attackTimer: number = 0;
    private attackElapsed: number = 0;
    public attackId: number = 0;
    public attackRange: number = 145;
    public attackMode: AttackMode = 'NONE';
    public attackPhase: AttackPhase = 'NONE';
    public rangedShotsFired: number = 0;
    public rangedCooldownRemaining: number = 0;
    private worldMaxX: number = window.innerWidth;
    private readonly standingHeight: number = 80;
    private readonly crouchHeight: number = 48;

    private readonly attackWindup: number = 0.1;
    private readonly attackActive: number = 0.14;
    private readonly attackRecovery: number = 0.16;
    private readonly rangedCooldown: number = 0.85;
    private pendingRangedShot: boolean = false;

    constructor() {
        this.body = new Body();
        this.body.w = 40;
        this.body.h = this.standingHeight;
        this.body.x = 100;
        this.body.y = 100;

        this.view = new Container();
        this.sprite = new SkeletalSprite(0x4488ff, HERO_SHEETS.gronk);
        this.view.addChild(this.sprite);

        this.slash = new Graphics();
        this.slash.visible = false;
        this.view.addChild(this.slash);
    }

    public setWorldBounds(width: number): void {
        this.worldMaxX = Math.max(window.innerWidth, width);
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

        this.isDashing = false;

        this.rangedCooldownRemaining = Math.max(0, this.rangedCooldownRemaining - dt);
        this.updateAttackState(dt);

        const targetSpeed = this.body.onGround ? this.speed : this.speed * this.airSpeedMultiplier;
        let targetVx = 0;
        if (input.isDown('ArrowLeft') || input.isDown('KeyA')) {
            targetVx = -targetSpeed;
            this.facingRight = false;
        } else if (input.isDown('ArrowRight') || input.isDown('KeyD')) {
            targetVx = targetSpeed;
            this.facingRight = true;
        }

        const smoothing = (targetVx === 0 ? this.deceleration : this.acceleration) * (this.body.onGround ? 1 : this.airControl);
        this.body.vx = this.moveToward(this.body.vx, targetVx, smoothing * dt);
        if (!this.body.onGround && Math.abs(this.body.vx) > targetSpeed) {
            this.body.vx = this.moveToward(this.body.vx, Math.sign(this.body.vx) * targetSpeed, this.deceleration * 1.25 * dt);
        }

        if ((input.justPressed('ArrowUp') || input.justPressed('KeyW') || input.actionJustPressed('jump')) && this.body.onGround) {
            this.body.vy = this.jumpForce;
            this.body.onGround = false;
            this.isCrouching = false;
        }

        const downHeld = input.isDown('ArrowDown') || input.isDown('KeyS');
        if ((input.justPressed('ArrowDown') || input.justPressed('KeyS') || input.actionJustPressed('pound')) && !this.body.onGround) {
            this.body.vy = Math.max(this.body.vy, 980);
            this.isPounding = true;
            this.isCrouching = false;
        } else if (this.body.onGround) {
            this.isPounding = false;
            this.isCrouching = downHeld;
        } else {
            this.isCrouching = false;
        }
        this.applyCrouchHitbox();

        if (input.justPressed('Space') || input.justPressed('KeyJ') || input.justPressed('KeyF') || input.justPressed('Enter') || input.actionJustPressed('attack')) {
             if (!this.isAttacking) {
                 this.isAttacking = true;
                 this.attackTimer = this.attackWindup + this.attackActive + this.attackRecovery;
                 this.attackElapsed = 0;
                 this.attackMode = 'MELEE';
                 this.attackPhase = 'WINDUP';
                 this.attackId++;
             }
        }

        if (input.justPressed('KeyK') || input.justPressed('KeyL') || input.actionJustPressed('ranged')) {
            if (this.rangedCooldownRemaining <= 0) {
                this.attackMode = 'RANGED';
                this.rangedCooldownRemaining = this.rangedCooldown;
                this.rangedShotsFired++;
                this.pendingRangedShot = true;
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

        this.sprite.update(dt, Math.abs(this.body.vx) / 220 || 1);
        this.sprite.setFacingRight(this.facingRight, this.body.w);
        this.sprite.scale.y = this.isCrouching ? 0.72 : this.isPounding ? 0.86 : 1;
        this.updateSlash();

        // Screen bounds logic (clamp instead of wrap for a room-based feel)
        this.clampToScreen();
    }

    private applyCrouchHitbox(): void {
        const targetHeight = this.isCrouching ? this.crouchHeight : this.standingHeight;
        if (this.body.h === targetHeight) return;
        const feetY = this.body.y + this.body.h;
        this.body.h = targetHeight;
        this.body.y = feetY - this.body.h;
    }

    public render(): void {
        this.view.position.set(this.body.x, this.body.y);
    }

    public canDealAttackDamage(): boolean {
        return this.attackPhase === 'ACTIVE';
    }

    public canDealPoundDamage(): boolean {
        return this.isPounding && this.body.vy > 300;
    }

    public isSlashVisible(): boolean {
        return this.slash.visible;
    }

    private updateAttackState(dt: number): void {
        if (!this.isAttacking) {
            this.attackPhase = 'NONE';
            return;
        }

        this.attackTimer -= dt;
        this.attackElapsed += dt;

        if (this.attackTimer <= 0) {
            this.isAttacking = false;
            this.attackPhase = 'NONE';
            return;
        }

        if (this.attackElapsed < this.attackWindup) {
            this.attackPhase = 'WINDUP';
        } else if (this.attackElapsed < this.attackWindup + this.attackActive) {
            this.attackPhase = 'ACTIVE';
        } else {
            this.attackPhase = 'RECOVERY';
        }
    }

    public consumeRangedShot(): boolean {
        if (!this.pendingRangedShot) return false;
        this.pendingRangedShot = false;
        return true;
    }

    public rangedCooldownReady(): boolean {
        return this.rangedCooldownRemaining <= 0;
    }

    private updateSlash(): void {
        this.slash.clear();
        this.slash.visible = this.attackPhase === 'ACTIVE';
        if (!this.slash.visible) return;

        const dir = this.facingRight ? 1 : -1;
        const x = this.facingRight ? this.body.w + 14 : -14;
        this.slash.moveTo(x, 8)
            .quadraticCurveTo(x + dir * 80, 28, x + dir * 108, 58)
            .stroke({ color: 0xfff1a8, width: 10, alpha: 0.9 });
        this.slash.moveTo(x + dir * 8, 22)
            .quadraticCurveTo(x + dir * 62, 38, x + dir * 88, 70)
            .stroke({ color: 0xff7a45, width: 4, alpha: 0.85 });
    }

    private moveToward(current: number, target: number, maxDelta: number): number {
        if (Math.abs(target - current) <= maxDelta) return target;
        return current + Math.sign(target - current) * maxDelta;
    }

    private clampToScreen(): void {
        if (this.body.x < 0) {
            this.body.x = 0;
            if (this.body.vx < 0) this.body.vx = 0;
        }
        if (this.body.x > this.worldMaxX - this.body.w) {
            this.body.x = this.worldMaxX - this.body.w;
            if (this.body.vx > 0) this.body.vx = 0;
        }
    }
}
