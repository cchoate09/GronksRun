import { Scene } from '../../engine/scenes/SceneManager';
import { GameEngine } from '../../engine/GameEngine';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Player } from '../entities/Player';
import { Enemy, RangedEnemy, HeavyEnemy, Projectile } from '../entities/Enemy';
import { BackgroundManager } from '../levels/BackgroundManager';
import { HUD } from '../entities/HUD';
import { ParticleSystem } from '../entities/ParticleSystem';
import { MenuScene } from './MenuScene';
import { readNumber, writeNumber } from '../storage';

export type EnemyKind = 'CHASER' | 'RANGED' | 'HEAVY' | 'SERPENT';

export interface LevelDefinition {
    id: number;
    name: string;
    biome: string;
    targetKills: number;
    maxActive: number;
    enemyKinds: EnemyKind[];
    spawnGap: number;
    runUpDistance: number;
    encounterSpacing: number;
    levelLength: number;
    reward: number;
}

export const LEVELS: LevelDefinition[] = [
    { id: 1, name: 'Blue Gate', biome: 'Ruined Coast', targetKills: 3, maxActive: 1, enemyKinds: ['CHASER'], spawnGap: 1.0, runUpDistance: 760, encounterSpacing: 580, levelLength: 2600, reward: 20 },
    { id: 2, name: 'Broken Steps', biome: 'Ruined Coast', targetKills: 4, maxActive: 1, enemyKinds: ['CHASER'], spawnGap: 0.95, runUpDistance: 820, encounterSpacing: 540, levelLength: 3200, reward: 25 },
    { id: 3, name: 'Witchline', biome: 'Moonlit Road', targetKills: 5, maxActive: 2, enemyKinds: ['CHASER', 'RANGED'], spawnGap: 0.9, runUpDistance: 880, encounterSpacing: 520, levelLength: 3800, reward: 30 },
    { id: 4, name: 'Serpent Run', biome: 'Temple Jungle', targetKills: 6, maxActive: 2, enemyKinds: ['CHASER', 'SERPENT'], spawnGap: 0.85, runUpDistance: 900, encounterSpacing: 500, levelLength: 4300, reward: 35 },
    { id: 5, name: 'Stone Guard', biome: 'Temple Jungle', targetKills: 7, maxActive: 2, enemyKinds: ['CHASER', 'HEAVY'], spawnGap: 0.8, runUpDistance: 920, encounterSpacing: 500, levelLength: 4800, reward: 40 },
    { id: 6, name: 'Crossfire', biome: 'Ash Ravine', targetKills: 8, maxActive: 2, enemyKinds: ['CHASER', 'RANGED', 'SERPENT'], spawnGap: 0.76, runUpDistance: 940, encounterSpacing: 480, levelLength: 5300, reward: 45 },
    { id: 7, name: 'Golem Bridge', biome: 'Ash Ravine', targetKills: 9, maxActive: 3, enemyKinds: ['CHASER', 'HEAVY', 'RANGED'], spawnGap: 0.72, runUpDistance: 960, encounterSpacing: 470, levelLength: 5800, reward: 50 },
    { id: 8, name: 'Night Ambush', biome: 'Glass City', targetKills: 10, maxActive: 3, enemyKinds: ['CHASER', 'SERPENT', 'RANGED'], spawnGap: 0.68, runUpDistance: 980, encounterSpacing: 460, levelLength: 6300, reward: 60 },
    { id: 9, name: 'Iron Rush', biome: 'Glass City', targetKills: 11, maxActive: 3, enemyKinds: ['CHASER', 'HEAVY', 'SERPENT'], spawnGap: 0.64, runUpDistance: 1000, encounterSpacing: 450, levelLength: 6800, reward: 70 },
    { id: 10, name: 'Gronk Gauntlet', biome: 'Sky Forge', targetKills: 12, maxActive: 3, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'SERPENT'], spawnGap: 0.6, runUpDistance: 1040, encounterSpacing: 440, levelLength: 7400, reward: 100 },
];

export class GameScene extends Scene {
    public static selectedLevel: number = 1;

    public static selectLevel(level: number): void {
        GameScene.selectedLevel = Math.min(LEVELS.length, Math.max(1, Math.floor(level)));
    }

    private stage: Container;
    private uiLayer: Container;
    private overlayLayer: Container;
    private player: Player;
    private enemies: Enemy[] = [];
    private projectiles: Projectile[] = [];
    private background: BackgroundManager;
    private hud: HUD;
    private particles: ParticleSystem;
    private level: LevelDefinition;
    
    private kills: number = 0;
    private gems: number = 0;
    private groundY: number;
    private ground: Graphics;
    private resizeHandler: () => void;
    private spawnTimer: number = 0;
    private nextSpawnX: number = 0;
    private cameraX: number = 0;
    private lastResolvedAttackId: number = -1;
    private hitThisAttack: Set<Enemy> = new Set();
    private state: 'PLAYING' | 'LEVEL_COMPLETE' | 'DEAD' = 'PLAYING';
    
    private shakeTimer: number = 0;
    private shakeIntensity: number = 0;

    constructor(engine: GameEngine) {
        super(engine);
        this.stage = new Container();
        this.uiLayer = new Container();
        this.overlayLayer = new Container();
        this.level = LEVELS[GameScene.selectedLevel - 1] || LEVELS[0];
        
        this.groundY = this.calculateGroundY();
        this.engine.physics.setGroundY(this.groundY);
        
        this.background = new BackgroundManager(this.stage, this.level.levelLength + window.innerWidth, window.innerHeight);
        
        this.ground = new Graphics();
        this.drawGround();
        this.stage.addChild(this.ground);

        this.player = new Player();
        this.player.setWorldBounds(this.level.levelLength);
        this.hud = new HUD();
        this.particles = new ParticleSystem();
        
        this.resizeHandler = () => this.syncViewportLayout();
    }

    public init(): void {
        this.engine.app.stage.addChild(this.stage);
        this.engine.app.stage.addChild(this.uiLayer);
        
        this.stage.addChild(this.player.view);
        this.stage.addChild(this.particles);
        this.uiLayer.addChild(this.hud);
        this.uiLayer.addChild(this.overlayLayer);
        
        this.engine.physics.addBody(this.player.body);
        window.addEventListener('resize', this.resizeHandler);
        window.addEventListener('keydown', this.handleKeyDown);

        this.gems = readNumber('gronk_gems', 0);
        this.nextSpawnX = this.level.runUpDistance;

        this.spawnWave(true);
        this.updateHUD();
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (this.state === 'LEVEL_COMPLETE' && (e.code === 'Enter' || e.code === 'Space')) {
            this.goToNextLevel();
        } else if (this.state === 'DEAD' && (e.code === 'Enter' || e.code === 'Space')) {
            this.restartLevel();
        } else if (e.code === 'Escape') {
            this.engine.scenes.loadScene(MenuScene);
        }
    };

    private calculateGroundY(): number {
        return Math.min(600, Math.max(220, window.innerHeight - 90));
    }

    private drawGround(): void {
        this.ground.clear();
        const topColor = this.level.id >= 8 ? 0x88e0ff : this.level.id >= 5 ? 0xffb347 : 0x50d6a8;
        const groundWidth = Math.max(this.level.levelLength + window.innerWidth, window.innerWidth * 2);
        this.ground.rect(0, this.groundY, groundWidth, 18).fill(topColor);
        this.ground.rect(0, this.groundY + 18, groundWidth, Math.max(160, window.innerHeight - this.groundY)).fill(0x12131a);
        for (let i = 0; i < groundWidth; i += 96) {
            this.ground.rect(i, this.groundY + 18, 4, window.innerHeight).fill(this.level.id >= 5 ? 0x33241e : 0x16262e);
            this.ground.circle(i + 38, this.groundY + 38, 7).fill(0x263647);
        }
    }

    private syncViewportLayout(): void {
        const nextGroundY = this.calculateGroundY();
        if (nextGroundY === this.groundY) return;
        this.groundY = nextGroundY;
        this.engine.physics.setGroundY(this.groundY);
        this.drawGround();
        this.player.setWorldBounds(this.level.levelLength);
        this.player.body.y = Math.min(this.player.body.y, this.groundY - this.player.body.h);
        for (const enemy of this.enemies) {
            enemy.body.y = Math.min(enemy.body.y, this.groundY - enemy.body.h);
        }
    }

    private spawnWave(initial: boolean = false): void {
        if (this.state !== 'PLAYING') return;
        const needed = Math.min(this.level.maxActive - this.enemies.length, this.level.targetKills - this.kills - this.enemies.length);
        if (needed <= 0) return;

        for (let i = 0; i < needed; i++) {
            const kind = this.level.enemyKinds[(this.kills + this.enemies.length + i) % this.level.enemyKinds.length];
            const spacing = initial ? 150 : 120;
            const minVisibleAhead = this.player.body.x + 520;
            const maxSpawnX = this.level.levelLength - 180;
            const x = Math.min(maxSpawnX, Math.max(this.nextSpawnX, minVisibleAhead) + i * spacing + Math.random() * 40);
            const enemy = this.createEnemy(kind, x);
            this.enemies.push(enemy);
            this.stage.addChild(enemy.view);
            this.engine.physics.addBody(enemy.body);
        }
        this.nextSpawnX = Math.min(this.level.levelLength - 180, this.nextSpawnX + this.level.encounterSpacing);
    }

    private createEnemy(kind: EnemyKind, x: number): Enemy {
        const y = this.groundY - 90;
        if (kind === 'RANGED') return new RangedEnemy(x, y);
        if (kind === 'HEAVY') return new HeavyEnemy(x, this.groundY - 110);
        if (kind === 'SERPENT') {
            const serpent = new Enemy(x, this.groundY - 58, 'SERPENT');
            serpent.body.w = 58;
            serpent.body.h = 48;
            return serpent;
        }
        return new Enemy(x, y, 'CHASER');
    }

    private applyShake(intensity: number, duration: number): void {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    public updateLogic(dt: number): void {
        if (this.state !== 'PLAYING') return;

        if (this.player.hp <= 0) {
            this.showDead();
            return;
        }

        this.player.update(dt, this.engine.input);
        this.updateCamera();
        this.background.update(dt, this.cameraX);
        this.particles.update(dt);

        if (this.player.attackId !== this.lastResolvedAttackId) {
            this.lastResolvedAttackId = this.player.attackId;
            this.hitThisAttack.clear();
        }

        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.stage.position.set(-this.cameraX + (Math.random() - 0.5) * this.shakeIntensity, (Math.random() - 0.5) * this.shakeIntensity);
        } else {
            this.stage.position.set(-this.cameraX, 0);
        }

        this.updateProjectiles(dt);
        this.updateEnemies(dt);

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.player.body.x + window.innerWidth * 0.78 >= this.nextSpawnX) {
            this.spawnTimer = this.level.spawnGap;
            this.spawnWave();
        }
    }

    private updateCamera(): void {
        const target = Math.max(0, this.player.body.x - window.innerWidth * 0.34);
        const maxCamera = Math.max(0, this.level.levelLength - window.innerWidth);
        this.cameraX += (Math.min(maxCamera, target) - this.cameraX) * 0.14;
        this.stage.x = -this.cameraX;
        this.stage.y = 0;
    }

    private updateProjectiles(dt: number): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            if (p.isDead) {
                this.stage.removeChild(p.view);
                this.engine.physics.removeBody(p.body);
                this.projectiles.splice(i, 1);
                continue;
            }
            
            if (!this.player.isDashing && !this.player.isAttacking && !this.player.isHit && this.overlaps(this.player.body, p.body, 8)) {
                this.player.takeDamage(10, Math.sign(this.player.body.x - p.body.x) || -1);
                this.applyShake(15, 0.2);
                p.isDead = true;
            }
        }
    }

    private updateEnemies(dt: number): void {
        for (const enemy of this.enemies) {
            enemy.update(dt, this.player.body.x);
            if (enemy.isDead) continue;

            if ((enemy as any).pendingShot) {
                (enemy as any).pendingShot = false;
                const vx = this.player.body.x < enemy.body.x ? -420 : 420;
                const p = new Projectile(enemy.body.x, enemy.body.y + 20, vx, -80);
                this.projectiles.push(p);
                this.stage.addChild(p.view);
                this.engine.physics.addBody(p.body);
            }

            const playerCanHurt = this.player.canDealAttackDamage();
            if (playerCanHurt && this.attackOverlaps(enemy) && !this.hitThisAttack.has(enemy)) {
                this.hitThisAttack.add(enemy);
                enemy.takeDamage(this.player.isDashing ? 38 : 28, this.player.facingRight ? 1 : -1);
                this.applyShake(10, 0.1);
                this.particles.spawn(enemy.body.x + enemy.body.w / 2, enemy.body.y + enemy.body.h / 2, 0xfff1a8, 12);
                if (enemy.isDead) this.registerKill(enemy);
                this.updateHUD();
                continue;
            }

            if (!this.player.isDashing && !this.player.isAttacking && !this.player.isHit && this.overlaps(this.player.body, enemy.body, 4)) {
                this.player.takeDamage(10, this.player.body.x < enemy.body.x ? -1 : 1);
                this.applyShake(15, 0.2);
                this.updateHUD();
            }
        }

        this.enemies = this.enemies.filter((enemy) => {
            if (!enemy.isDead) return true;
            this.stage.removeChild(enemy.view);
            this.engine.physics.removeBody(enemy.body);
            return false;
        });
    }

    private registerKill(enemy: Enemy): void {
        this.kills++;
        this.gems += 5;
        this.particles.spawn(enemy.body.x + enemy.body.w / 2, enemy.body.y + enemy.body.h / 2, 0xffd700, 16);
        writeNumber('gronk_gems', this.gems);
        if (this.kills >= this.level.targetKills) {
            this.completeLevel();
        }
    }

    private attackOverlaps(enemy: Enemy): boolean {
        const range = this.player.isDashing ? 95 : this.player.attackRange;
        const minX = this.player.facingRight ? this.player.body.x + this.player.body.w - 6 : this.player.body.x - range;
        const maxX = this.player.facingRight ? this.player.body.x + this.player.body.w + range : this.player.body.x + 6;
        const verticalPad = this.player.isDashing ? 50 : 78;
        return enemy.body.x < maxX
            && enemy.body.x + enemy.body.w > minX
            && enemy.body.y < this.player.body.y + this.player.body.h + verticalPad
            && enemy.body.y + enemy.body.h > this.player.body.y - verticalPad;
    }

    private overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad: number = 0): boolean {
        return a.x < b.x + b.w + pad
            && a.x + a.w + pad > b.x
            && a.y < b.y + b.h + pad
            && a.y + a.h + pad > b.y;
    }

    private completeLevel(): void {
        this.state = 'LEVEL_COMPLETE';
        const unlocked = Math.max(readNumber('gronk_unlocked_level', 1), Math.min(LEVELS.length, this.level.id + 1));
        writeNumber('gronk_unlocked_level', unlocked);
        this.gems += this.level.reward;
        writeNumber('gronk_gems', this.gems);
        this.updateHUD();
        this.drawResultOverlay('LEVEL CLEAR', `${this.level.name} complete`, 'ENTER / TAP: NEXT LEVEL');
    }

    private showDead(): void {
        this.state = 'DEAD';
        this.drawResultOverlay('RUN ENDED', 'Try the attack before contact', 'ENTER / TAP: RETRY');
    }

    private drawResultOverlay(title: string, subtitle: string, cta: string): void {
        this.overlayLayer.removeChildren();
        const shade = new Graphics();
        shade.rect(0, 0, window.innerWidth, window.innerHeight).fill({ color: 0x05070b, alpha: 0.68 });
        this.overlayLayer.addChild(shade);

        const panelW = Math.min(520, window.innerWidth - 48);
        const panelH = 260;
        const panelX = (window.innerWidth - panelW) / 2;
        const panelY = Math.max(40, (window.innerHeight - panelH) / 2);
        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 12).fill(0x101822).stroke({ color: 0x67e8f9, width: 2 });
        this.overlayLayer.addChild(panel);

        const titleText = new Text({ text: title, style: new TextStyle({ fill: 0xffffff, fontSize: 42, fontWeight: 'bold' }) });
        titleText.anchor.set(0.5);
        titleText.position.set(window.innerWidth / 2, panelY + 62);
        this.overlayLayer.addChild(titleText);

        const subText = new Text({ text: subtitle, style: new TextStyle({ fill: 0x91e5ff, fontSize: 22, fontWeight: 'bold' }) });
        subText.anchor.set(0.5);
        subText.position.set(window.innerWidth / 2, panelY + 114);
        this.overlayLayer.addChild(subText);

        const rewardText = new Text({ text: `GEMS ${this.gems}`, style: new TextStyle({ fill: 0xffd166, fontSize: 24, fontWeight: 'bold' }) });
        rewardText.anchor.set(0.5);
        rewardText.position.set(window.innerWidth / 2, panelY + 158);
        this.overlayLayer.addChild(rewardText);

        const button = new Graphics();
        button.roundRect(panelX + 70, panelY + 190, panelW - 140, 48, 10).fill(0x44ff88);
        this.overlayLayer.addChild(button);

        const buttonText = new Text({ text: cta, style: new TextStyle({ fill: 0x07110b, fontSize: 18, fontWeight: 'bold' }) });
        buttonText.anchor.set(0.5);
        buttonText.position.set(window.innerWidth / 2, panelY + 214);
        this.overlayLayer.addChild(buttonText);

        this.overlayLayer.eventMode = 'static';
        this.overlayLayer.cursor = 'pointer';
        this.overlayLayer.removeAllListeners('pointerdown');
        this.overlayLayer.on('pointerdown', () => {
            if (this.state === 'LEVEL_COMPLETE') this.goToNextLevel();
            if (this.state === 'DEAD') this.restartLevel();
        });
    }

    private goToNextLevel(): void {
        GameScene.selectLevel(this.level.id >= LEVELS.length ? 1 : this.level.id + 1);
        this.engine.scenes.loadScene(GameScene);
    }

    private restartLevel(): void {
        GameScene.selectLevel(this.level.id);
        this.engine.scenes.loadScene(GameScene);
    }

    private updateHUD(): void {
        this.hud.updateStats(this.player.hp, 100, this.gems, this.level.id, this.kills, this.level.targetKills);
    }

    public render(alpha: number): void {
        this.player.render();
        for (const enemy of this.enemies) enemy.render();
        for (const p of this.projectiles) p.view.position.set(p.body.x, p.body.y);
    }

    public destroy(): void {
        window.removeEventListener('resize', this.resizeHandler);
        window.removeEventListener('keydown', this.handleKeyDown);
        this.engine.app.stage.removeChild(this.stage);
        this.engine.app.stage.removeChild(this.uiLayer);
        this.engine.physics.removeBody(this.player.body);
        for (const enemy of this.enemies) this.engine.physics.removeBody(enemy.body);
        for (const p of this.projectiles) this.engine.physics.removeBody(p.body);
        this.stage.destroy({ children: true });
        this.uiLayer.destroy({ children: true });
    }

    public getSnapshot(): unknown {
        return {
            phase: this.state,
            level: this.level.id,
            level_name: this.level.name,
            biome: this.level.biome,
            kills: this.kills,
            target_kills: this.level.targetKills,
            gems: this.gems,
            player: {
                x: Math.round(this.player.body.x),
                screenX: Math.round(this.player.body.x - this.cameraX),
                y: Math.round(this.player.body.y),
                vx: Math.round(this.player.body.vx),
                vy: Math.round(this.player.body.vy),
                hp: this.player.hp,
                onGround: this.player.body.onGround,
                attacking: this.player.isAttacking,
                dashing: this.player.isDashing,
                facingRight: this.player.facingRight,
                attackId: this.player.attackId,
                attackPhase: this.player.attackPhase,
                slashVisible: this.player.isSlashVisible(),
            },
            camera: { x: Math.round(this.cameraX) },
            pacing: {
                run_up_distance: this.level.runUpDistance,
                next_spawn_x: Math.round(this.nextSpawnX),
                level_length: this.level.levelLength,
            },
            enemies: this.enemies.map((enemy) => ({
                type: enemy.type,
                x: Math.round(enemy.body.x),
                screenX: Math.round(enemy.body.x - this.cameraX),
                y: Math.round(enemy.body.y),
                hp: enemy.hp,
                dead: enemy.isDead,
            })),
            projectiles: this.projectiles.length,
        };
    }
}
