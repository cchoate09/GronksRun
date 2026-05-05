import { GameEngine } from '../GameEngine';

export abstract class Scene {
    protected engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    public abstract init(): void;
    public abstract updateLogic(dt: number): void;
    public abstract render(alpha: number): void;
    public abstract destroy(): void;
    public getSnapshot?(): unknown;
}

export class SceneManager {
    private engine: GameEngine;
    private currentScene: Scene | null = null;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    public async loadScene(sceneClass: new (engine: GameEngine) => Scene): Promise<void> {
        if (this.currentScene) {
            this.currentScene.destroy();
        }

        // Stale taps from the outgoing scene must not leak into the incoming
        // one (e.g. menu's confirm-press triggering a player jump on level 1).
        this.engine.input.clearActions();
        // Construct + init the new scene BEFORE unpausing the engine, so the
        // ticker can never observe a half-built stage between init() returning
        // and the scene's listeners binding.
        this.currentScene = new sceneClass(this.engine);
        this.currentScene.init();
        this.engine.paused = false;
    }

    public updateLogic(dt: number): void {
        if (this.currentScene) {
            this.currentScene.updateLogic(dt);
        }
    }

    public render(alpha: number): void {
        if (this.currentScene) {
            this.currentScene.render(alpha);
        }
    }

    public getSnapshot(): unknown {
        return this.currentScene && this.currentScene.getSnapshot
            ? this.currentScene.getSnapshot()
            : null;
    }
}
