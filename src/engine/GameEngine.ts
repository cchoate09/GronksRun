import { Application } from 'pixi.js';
import { PhysicsEngine } from './physics';
import { SceneManager } from './scenes/SceneManager';
import { InputManager } from './input';

export class GameEngine {
    public app: Application;
    public physics: PhysicsEngine;
    public scenes: SceneManager;
    public input: InputManager;

    private fixedTimeStep: number = 1000 / 60;
    private accumulator: number = 0;
    private lastTime: number = 0;

    constructor() {
        this.app = new Application();
        this.physics = new PhysicsEngine();
        this.scenes = new SceneManager(this);
        this.input = new InputManager();
    }

    public async initialize(canvasElement: HTMLCanvasElement): Promise<void> {
        await this.app.init({
            canvas: canvasElement,
            resizeTo: window,
            backgroundColor: 0x1a1a24, // Dark modern background
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        // Setup the game loop
        this.lastTime = performance.now();
        this.app.ticker.add(this.update.bind(this));
    }

    private update(ticker: any): void {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Prevent spiral of death if tab is inactive
        if (deltaTime > 250) return;

        this.accumulator += deltaTime;

        // Fixed timestep for physics and logic
        while (this.accumulator >= this.fixedTimeStep) {
            this.input.update();
            this.physics.step(this.fixedTimeStep / 1000); // Pass delta in seconds
            this.scenes.updateLogic(this.fixedTimeStep / 1000);
            this.accumulator -= this.fixedTimeStep;
        }

        // Render update (variable framerate)
        const alpha = this.accumulator / this.fixedTimeStep;
        this.scenes.render(alpha);
    }

    public step(ms: number): void {
        const clampedMs = Math.max(0, Math.min(ms, 1000));
        this.accumulator += clampedMs;

        while (this.accumulator >= this.fixedTimeStep) {
            this.input.update();
            this.physics.step(this.fixedTimeStep / 1000);
            this.scenes.updateLogic(this.fixedTimeStep / 1000);
            this.accumulator -= this.fixedTimeStep;
        }

        this.scenes.render(this.accumulator / this.fixedTimeStep);
    }
}
