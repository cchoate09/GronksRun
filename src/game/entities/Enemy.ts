import { Body } from '../../engine/physics';
import { Container, Graphics } from 'pixi.js';
import { SkeletalSprite } from './SkeletalSprite';
import { ENEMY_SHEETS } from '../assets/spriteData';

export class Projectile {
    public body: Body;
    public view: Graphics;
    public isDead: boolean = false;
    public damage: number;
    public highProjectile: boolean;
    public explosionRadius: number = 0;
    public hasExploded: boolean = false;
    private maxX: number;

    constructor(x: number, y: number, vx: number, vy: number, color: number = 0xffff00, gravityScale: number = 0.2, damage: number = 10, maxX: number = window.innerWidth + 100, highProjectile: boolean = false) {
        this.body = new Body();
        this.body.x = x;
        this.body.y = y;
        this.body.w = 10;
        this.body.h = 10;
        this.body.vx = vx;
        this.body.vy = vy;
        this.body.gravityScale = gravityScale;
        this.damage = damage;
        this.highProjectile = highProjectile;
        this.maxX = maxX;

        this.view = new Graphics();
        this.view.circle(5, 5, 5).fill(color);
    }

    public update(dt: number): void {
        // Y-bound check kills bombs that fall into a pit and would otherwise
        // never touch ground or cross the x bounds. Without this, lobbed
        // explosives leak forever in physics during long endless runs.
        const yLimit = (typeof window !== 'undefined' ? window.innerHeight : 1080) + 600;
        if (this.body.onGround || this.body.x < -100 || this.body.x > this.maxX || this.body.y > yLimit) {
            this.isDead = true;
        }
    }
}

export interface EnemyTargetSnapshot {
    x: number;
    y: number;
    vx: number;
    vy: number;
    onGround: boolean;
    width: number;
    height: number;
}

export type EnemyType = 'CHASER' | 'RANGED' | 'HEAVY' | 'SERPENT' | 'BOMBER' | 'DIVER' | 'PTERO' | 'GUARDIAN';

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
    public isAttacking: boolean = false;
    private playerKnockbackTimer: number = 0;
    protected attackCooldownRemaining: number = 0;
    protected attackTimer: number = 0;
    protected attackCooldown: number = 1.0;
    protected attackDuration: number = 0.24;
    protected lungeSpeed: number = 118;
    public mechanic: string = 'smart_chase_lunge';
    
    public type: EnemyType = 'CHASER';

    constructor(x: number, y: number, type: EnemyType = 'CHASER') {
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

    public update(dt: number, target: number | EnemyTargetSnapshot): void {
        if (this.isDead) return;
        const targetSnapshot = this.normalizeTarget(target);

        this.playerKnockbackTimer = Math.max(0, this.playerKnockbackTimer - dt);
        this.attackCooldownRemaining = Math.max(0, this.attackCooldownRemaining - dt);
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            this.isAttacking = true;
        } else {
            this.isAttacking = false;
        }

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
            this.aiLogic(dt, targetSnapshot);
        }

        const believableRunScale = Math.min(1.08, Math.max(0.68, Math.abs(this.body.vx) / 190 || 0.72));
        this.sprite.update(dt, believableRunScale);
        this.sprite.setFacingRight(this.facingRight, this.body.w);
    }

    protected normalizeTarget(target: number | EnemyTargetSnapshot): EnemyTargetSnapshot {
        if (typeof target === 'number') {
            return { x: target, y: this.body.y, vx: 0, vy: 0, onGround: true, width: 40, height: 80 };
        }
        return target;
    }

    protected aiLogic(dt: number, target: EnemyTargetSnapshot): void {
        const directDx = target.x - this.body.x;
        const predictedX = target.x + target.vx * (target.onGround ? 0.18 : 0.28);
        const dx = predictedX - this.body.x;
        const dist = Math.abs(directDx);
        const dir = Math.sign(dx || directDx || (this.facingRight ? 1 : -1));
        const playerAbove = target.y + target.height * 0.45 < this.body.y + this.body.h * 0.2;

        this.facingRight = directDx > 0;

        if (playerAbove && dist < 310 && this.body.onGround && this.attackCooldownRemaining <= 0.2) {
            this.body.vy = -340;
            this.body.onGround = false;
        }

        if (dist > 780) {
            this.body.vx = dir * this.speed * 0.48;
            this.sprite.setState('RUN');
            return;
        }

        if (dist > 132) {
            const chasingRunner = Math.sign(target.vx || dir) === dir && Math.abs(target.vx) > 80;
            const pressure = chasingRunner ? 1.18 : target.onGround ? 1.04 : 1.12;
            this.body.vx = dir * this.speed * pressure;
            this.sprite.setState('RUN');
            return;
        }

        if (this.attackCooldownRemaining <= 0) {
            this.attackCooldownRemaining = this.attackCooldown;
            this.attackTimer = this.attackDuration;
            this.isAttacking = true;
        }

        const lunge = this.isAttacking ? this.lungeSpeed * 1.18 : this.speed * 0.96;
        this.body.vx = dir * lunge;
        this.sprite.setState(this.isAttacking ? 'ATTACK' : 'RUN');
    }

    public canDealContactDamage(): boolean {
        return this.isAttacking || Math.abs(this.body.vx) > this.speed * 0.7;
    }

    public hasPlayerKnockbackCredit(): boolean {
        return this.playerKnockbackTimer > 0;
    }

    public takePoundDamage(amount: number, knockbackDir: number): void {
        this.takeDamage(amount, knockbackDir);
    }

    public takeDamage(amount: number, knockbackDir: number): void {
        if (this.isDead) return;

        this.hp -= amount;
        this.isHit = true;
        this.hitTimer = 0.2;
        this.playerKnockbackTimer = 2.0;
        
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
    public pendingShot: boolean = false;
    public pendingShotLead: number = 0;
    public pendingShotHigh: boolean = true;

    constructor(x: number, y: number) {
        super(x, y, 'RANGED');
        this.type = 'RANGED';
        this.mechanic = 'predictive_highProjectile';
        this.sprite.tint = 0xffffff;
        this.speed = 118;
    }

    protected aiLogic(dt: number, target: EnemyTargetSnapshot): void {
        const directDx = target.x - this.body.x;
        const predictedX = target.x + target.vx * 0.32;
        const dx = predictedX - this.body.x;
        const dist = Math.abs(directDx);
        const dir = Math.sign(dx || directDx || (this.facingRight ? 1 : -1));
        this.isAttacking = false;
        this.shootTimer += dt;
        this.facingRight = directDx > 0;

        if (dist > 780) {
            this.body.vx = dir * this.speed * 0.78;
            this.sprite.setState('RUN');
            return;
        }

        if (dist > 470) {
            this.body.vx = dir * this.speed * 1.05;
            this.sprite.setState('RUN');
        } else if (dist < 270) {
            this.body.vx = -Math.sign(directDx || dir) * this.speed * 1.18;
            this.sprite.setState('RUN');
        } else {
            this.body.vx = Math.abs(target.vx) > 80 ? Math.sign(target.vx) * this.speed * 0.18 : 0;
            this.sprite.setState('IDLE');
        }

        if (dist <= 560 && this.shootTimer >= this.shootCooldown) {
            this.shootTimer = 0;
            this.isAttacking = true;
            this.sprite.setState('ATTACK');
            this.pendingShot = true;
            this.pendingShotLead = target.vx * 0.34;
            this.pendingShotHigh = target.onGround && Math.abs(target.y - this.body.y) < 92;
        }
    }
}

export class HeavyEnemy extends Enemy {
    constructor(x: number, y: number) {
        super(x, y, 'HEAVY');
        this.type = 'HEAVY';
        this.mechanic = 'smart_armored_pound_break';
        this.maxHp = 150;
        this.hp = 150;
        this.speed = 98;
        this.lungeSpeed = 130;
        this.attackCooldown = 1.25;
        this.attackDuration = 0.34;
        this.body.w = 70;
        this.body.h = 90;
        this.sprite.scale.set(1.5);
        this.sprite.tint = 0xffffff;
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
        super.takeDamage(Math.max(8, Math.round(amount * 0.62)), knockbackDir * 0.3);
    }

    public takePoundDamage(amount: number, knockbackDir: number): void {
        super.takeDamage(Math.round(amount * 1.65), knockbackDir * 0.7);
    }
}

export class SerpentEnemy extends Enemy {
    private leapTimer: number = 0;

    constructor(x: number, y: number) {
        super(x, y, 'SERPENT');
        this.mechanic = 'low_leap';
        this.speed = 185;
        this.lungeSpeed = 230;
        this.attackCooldown = 0.86;
        this.attackDuration = 0.18;
        this.body.w = 58;
        this.body.h = 48;
    }

    protected aiLogic(dt: number, target: EnemyTargetSnapshot): void {
        const predictedX = target.x + target.vx * (target.onGround ? 0.14 : 0.22);
        const directDx = target.x - this.body.x;
        const dx = predictedX - this.body.x;
        const dist = Math.abs(directDx);
        const dir = Math.sign(dx || directDx || (this.facingRight ? 1 : -1));
        this.facingRight = directDx > 0;
        this.leapTimer = Math.max(0, this.leapTimer - dt);

        if (dist > 720) {
            this.body.vx = dir * this.speed * 0.72;
            this.sprite.setState('RUN');
            return;
        }

        if (dist > 104) {
            this.body.vx = dir * this.speed * (target.onGround ? 1 : 1.16);
            this.sprite.setState('RUN');
            if (!target.onGround && target.y < this.body.y - 28 && dist < 330 && this.body.onGround && this.leapTimer <= 0) {
                this.leapTimer = 0.5;
                this.body.vy = -300;
                this.body.onGround = false;
            }
            return;
        }

        if (this.attackCooldownRemaining <= 0 && this.leapTimer <= 0) {
            this.attackCooldownRemaining = this.attackCooldown;
            this.attackTimer = this.attackDuration;
            this.leapTimer = 0.55;
            this.isAttacking = true;
            this.body.vx = dir * this.lungeSpeed;
            this.body.vy = -260;
            this.body.onGround = false;
            this.sprite.setState('ATTACK');
            return;
        }

        this.body.vx = dir * this.speed * 0.68;
        this.sprite.setState(this.isAttacking ? 'ATTACK' : 'RUN');
    }
}

export class BomberEnemy extends Enemy {
    private bombTimer: number = 0;
    private bombCooldown: number = 1.65;
    public pendingBomb: boolean = false;

    constructor(x: number, y: number) {
        super(x, y, 'BOMBER');
        this.type = 'BOMBER';
        this.mechanic = 'lob_bomber';
        this.maxHp = 62;
        this.hp = 62;
        this.speed = 124;
        this.attackCooldown = 1.1;
        this.body.w = 54;
        this.body.h = 62;
        this.drawHpBar();
    }

    protected aiLogic(dt: number, target: EnemyTargetSnapshot): void {
        const predictedX = target.x + target.vx * 0.3;
        const directDx = target.x - this.body.x;
        const dx = predictedX - this.body.x;
        const dist = Math.abs(directDx);
        const dir = Math.sign(dx || directDx || (this.facingRight ? 1 : -1));
        this.facingRight = directDx > 0;
        this.bombTimer += dt;

        if (dist > 620) {
            this.body.vx = dir * this.speed;
            this.sprite.setState('RUN');
        } else if (dist < 280) {
            this.body.vx = -Math.sign(directDx || dir) * this.speed * 1.08;
            this.sprite.setState('RUN');
        } else {
            this.body.vx = Math.sign(target.vx || -dir) * this.speed * 0.22;
            this.sprite.setState('IDLE');
        }

        if (dist <= 620 && this.bombTimer >= this.bombCooldown) {
            this.bombTimer = 0;
            this.pendingBomb = true;
            this.isAttacking = true;
            this.attackTimer = 0.28;
            this.sprite.setState('ATTACK');
        }
    }
}

export class DiverEnemy extends Enemy {
    private hoverY: number;
    private hoverPhase: number = 0;
    private diveCooldownRemaining: number = 0.4;
    public diveAttack: boolean = false;

    constructor(x: number, y: number) {
        super(x, y, 'DIVER');
        this.type = 'DIVER';
        this.mechanic = 'diveAttack';
        this.maxHp = 44;
        this.hp = 44;
        this.speed = 190;
        this.lungeSpeed = 270;
        this.attackDuration = 0.35;
        this.body.w = 54;
        this.body.h = 46;
        this.body.gravityScale = 0;
        this.hoverY = y;
        this.drawHpBar();
    }

    protected aiLogic(dt: number, target: EnemyTargetSnapshot): void {
        const directDx = target.x - this.body.x;
        const dist = Math.abs(directDx);
        const dir = Math.sign(directDx || (this.facingRight ? 1 : -1));
        this.facingRight = directDx > 0;
        this.body.onGround = false;
        this.hoverPhase += dt;
        this.diveCooldownRemaining = Math.max(0, this.diveCooldownRemaining - dt);

        if (this.diveAttack) {
            this.body.vx = dir * this.lungeSpeed;
            this.body.vy = 330;
            this.sprite.setState('ATTACK');
            if (this.body.y > target.y - 18 || dist > 620) {
                this.diveAttack = false;
                this.diveCooldownRemaining = 1.25;
            }
            return;
        }

        const desiredY = Math.max(90, Math.min(this.hoverY, target.y - 170));
        this.body.vy = (desiredY - this.body.y) * 2.7 + Math.sin(this.hoverPhase * 6 + this.body.x * 0.01) * 28;

        if (dist > 700) {
            this.body.vx = dir * this.speed * 0.62;
            this.sprite.setState('RUN');
            return;
        }

        if (dist < 420 && this.diveCooldownRemaining <= 0) {
            this.diveAttack = true;
            this.isAttacking = true;
            this.attackTimer = this.attackDuration;
            this.sprite.setState('ATTACK');
            return;
        }

        this.body.vx = dir * this.speed * 0.72;
        this.sprite.setState('RUN');
    }
}

export class PteroEnemy extends Enemy {
    public diveAttack: boolean = false;
    private swoopCooldownRemaining: number = 0.2;

    constructor(x: number, y: number) {
        super(x, y, 'PTERO');
        this.type = 'PTERO';
        this.mechanic = 'fast_swoop';
        this.maxHp = 36;
        this.hp = 36;
        this.speed = 260;
        this.lungeSpeed = 420;
        this.attackDuration = 0.28;
        this.body.w = 72;
        this.body.h = 42;
        this.body.gravityScale = 0;
        this.drawHpBar();
    }

    protected aiLogic(dt: number, target: EnemyTargetSnapshot): void {
        const predictedX = target.x + target.vx * 0.24;
        const directDx = predictedX - this.body.x;
        const dist = Math.abs(target.x - this.body.x);
        const dir = Math.sign(directDx || (this.facingRight ? 1 : -1));
        this.facingRight = directDx > 0;
        this.body.onGround = false;
        this.swoopCooldownRemaining = Math.max(0, this.swoopCooldownRemaining - dt);

        if (dist < 460 && this.swoopCooldownRemaining <= 0) {
            this.diveAttack = true;
            this.isAttacking = true;
            this.attackTimer = this.attackDuration;
            this.swoopCooldownRemaining = 1.05;
        }

        const laneY = this.diveAttack ? target.y + 8 : Math.max(92, target.y - 150);
        this.body.vx = dir * (this.diveAttack ? this.lungeSpeed : this.speed);
        this.body.vy = (laneY - this.body.y) * (this.diveAttack ? 3.5 : 2.2);
        this.sprite.setState(this.diveAttack ? 'ATTACK' : 'RUN');

        if (this.diveAttack && (dist > 620 || this.body.y > target.y + 24)) {
            this.diveAttack = false;
        }
    }
}

export class GuardianEnemy extends Enemy {
    private guardTimer: number = 0;

    constructor(x: number, y: number) {
        super(x, y, 'GUARDIAN');
        this.type = 'GUARDIAN';
        this.mechanic = 'shielded_guardian';
        this.maxHp = 120;
        this.hp = 120;
        this.speed = 88;
        this.lungeSpeed = 168;
        this.attackCooldown = 1.4;
        this.attackDuration = 0.42;
        this.body.w = 66;
        this.body.h = 78;
        this.drawHpBar();
    }

    protected aiLogic(dt: number, target: EnemyTargetSnapshot): void {
        const directDx = target.x - this.body.x;
        const dist = Math.abs(directDx);
        const dir = Math.sign(directDx || (this.facingRight ? 1 : -1));
        this.facingRight = directDx > 0;
        this.guardTimer = Math.max(0, this.guardTimer - dt);

        if (dist > 620) {
            this.body.vx = dir * this.speed * 0.85;
            this.sprite.setState('RUN');
            return;
        }

        if (dist > 150) {
            this.body.vx = dir * this.speed * (this.guardTimer > 0 ? 0.45 : 1.05);
            this.sprite.setState('RUN');
            return;
        }

        if (this.attackCooldownRemaining <= 0) {
            this.attackCooldownRemaining = this.attackCooldown;
            this.attackTimer = this.attackDuration;
            this.guardTimer = 0.7;
            this.isAttacking = true;
        }

        this.body.vx = dir * (this.isAttacking ? this.lungeSpeed : this.speed * 0.38);
        this.sprite.setState(this.isAttacking ? 'ATTACK' : 'IDLE');
    }

    public takeDamage(amount: number, knockbackDir: number): void {
        const frontalHit = knockbackDir === (this.facingRight ? 1 : -1);
        const guardedAmount = frontalHit ? Math.max(6, Math.round(amount * 0.42)) : amount;
        super.takeDamage(guardedAmount, frontalHit ? knockbackDir * 0.18 : knockbackDir * 0.55);
    }

    public takePoundDamage(amount: number, knockbackDir: number): void {
        super.takeDamage(Math.round(amount * 1.35), knockbackDir * 0.55);
    }
}
