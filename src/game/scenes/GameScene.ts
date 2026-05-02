import { Scene } from '../../engine/scenes/SceneManager';
import { GameEngine } from '../../engine/GameEngine';
import { Graphics, Container, Text } from 'pixi.js';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { BackgroundManager } from '../levels/BackgroundManager';

export class GameScene extends Scene {
    private stage: Container;
    private player: Player;
    private enemies: Enemy[] = [];
    private background: BackgroundManager;
    private roomText: Text;
    private roomCount: number = 1;

    constructor(engine: GameEngine) {
        super(engine);
        this.stage = new Container();
        
        this.background = new BackgroundManager(this.stage, window.innerWidth, window.innerHeight);
        
        // Ground
        const ground = new Graphics();
        ground.rect(0, 600, window.innerWidth * 2, 200).fill(0x11111a);
        this.stage.addChild(ground);

        this.player = new Player();
        
        this.roomText = new Text({ text: 'ROOM 1', style: { fill: 0xffffff, fontSize: 32, fontWeight: 'bold' } });
        this.roomText.position.set(20, 20);
    }

    public init(): void {
        this.engine.app.stage.addChild(this.stage);
        this.engine.app.stage.addChild(this.roomText);
        
        this.stage.addChild(this.player.view);
        this.engine.physics.addBody(this.player.body);

        this.spawnWave();
    }

    private spawnWave(): void {
        const count = 2 + Math.floor(this.roomCount / 2);
        for (let i = 0; i < count; i++) {
            this.spawnEnemy(window.innerWidth + Math.random() * 400, 100);
        }
    }

    private spawnEnemy(x: number, y: number): void {
        const enemy = new Enemy(x, y);
        this.enemies.push(enemy);
        this.stage.addChild(enemy.view);
        this.engine.physics.addBody(enemy.body);
    }

    public updateLogic(dt: number): void {
        this.player.update(dt, this.engine.input);
        
        // Background parallax follows player
        this.background.update(dt, this.player.body.x);

        // Enemy logic & Combat
        for (const enemy of this.enemies) {
            enemy.update(dt, this.player.body.x);

            if (enemy.isDead) continue;

            // Combat resolution
            if (this.player.isAttacking) {
                const attackRange = 60;
                const minX = this.player.facingRight ? this.player.body.x + this.player.body.w : this.player.body.x - attackRange;
                const maxX = this.player.facingRight ? this.player.body.x + this.player.body.w + attackRange : this.player.body.x;

                // Simple AABB overlap for the attack box
                if (enemy.body.x < maxX && enemy.body.x + enemy.body.w > minX &&
                    Math.abs(enemy.body.y - this.player.body.y) < 50) {
                    
                    if (!enemy.isHit) {
                        const dir = this.player.facingRight ? 1 : -1;
                        enemy.takeDamage(20, dir);
                    }
                }
            }
        }

        // Cleanup dead enemies from physics
        this.enemies = this.enemies.filter(e => {
            if (e.isDead) {
                this.engine.physics.removeBody(e.body);
            }
            return !e.isDead;
        });

        // Roguelite Progression
        if (this.enemies.length === 0) {
            this.roomCount++;
            this.roomText.text = `ROOM ${this.roomCount}`;
            this.spawnWave();
        }
    }

    public render(alpha: number): void {
        this.player.render();
        for (const enemy of this.enemies) {
            enemy.render();
        }
    }

    public destroy(): void {
        this.engine.app.stage.removeChild(this.stage);
        this.engine.physics.removeBody(this.player.body);
        for (const enemy of this.enemies) {
            this.engine.physics.removeBody(enemy.body);
        }
        this.stage.destroy({ children: true });
    }

    public getSnapshot(): unknown {
        return {
            phase: 'PLAYING',
            room: this.roomCount,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
            player: {
                x: Math.round(this.player.body.x),
                y: Math.round(this.player.body.y),
                vx: Math.round(this.player.body.vx),
                vy: Math.round(this.player.body.vy),
                hp: this.player.hp,
                onGround: this.player.body.onGround,
                attacking: this.player.isAttacking,
            },
            enemies: this.enemies
                .filter((enemy) => !enemy.isDead)
                .map((enemy) => ({
                    x: Math.round(enemy.body.x),
                    y: Math.round(enemy.body.y),
                    hp: enemy.hp,
                    hit: enemy.isHit,
                })),
        };
    }
}
