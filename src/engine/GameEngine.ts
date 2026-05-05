import { Application, Ticker } from 'pixi.js';
import { PhysicsEngine } from './physics';
import { SceneManager } from './scenes/SceneManager';
import { InputManager } from './input';

export class GameEngine {
    public app: Application;
    public physics: PhysicsEngine;
    public scenes: SceneManager;
    public input: InputManager;

    // When true the fixed-step loop (input drain + physics + scene logic) is
    // skipped. Render still runs so pause overlays animate. Scenes set this
    // when they enter pause state.
    public paused: boolean = false;

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
        const preserveDrawingBuffer = typeof navigator !== 'undefined' && navigator.webdriver === true;

        await this.app.init({
            canvas: canvasElement,
            resizeTo: window,
            backgroundColor: 0x1a1a24,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            preserveDrawingBuffer,
        });

        this.lastTime = performance.now();
        this.app.ticker.add(this.update.bind(this));
    }

    private update(_ticker: Ticker): void {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Prevent spiral of death if tab is inactive
        if (deltaTime > 250) return;

        if (this.paused) {
            this.accumulator = 0;
            this.scenes.render(0);
            return;
        }

        this.accumulator += deltaTime;

        this.input.beginFrame();
        while (this.accumulator >= this.fixedTimeStep) {
            this.input.update();
            this.physics.step(this.fixedTimeStep / 1000);
            this.scenes.updateLogic(this.fixedTimeStep / 1000);
            this.input.endFrame();
            this.accumulator -= this.fixedTimeStep;
        }

        const alpha = this.accumulator / this.fixedTimeStep;
        this.scenes.render(alpha);
    }

    public step(ms: number): void {
        const clampedMs = Math.max(0, Math.min(ms, 1000));
        this.accumulator += clampedMs;

        this.input.beginFrame();
        while (this.accumulator >= this.fixedTimeStep) {
            this.input.update();
            this.physics.step(this.fixedTimeStep / 1000);
            this.scenes.updateLogic(this.fixedTimeStep / 1000);
            this.input.endFrame();
            this.accumulator -= this.fixedTimeStep;
        }

        this.scenes.render(this.accumulator / this.fixedTimeStep);
        this.app.render();
    }
}
