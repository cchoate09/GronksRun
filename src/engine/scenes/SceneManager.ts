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

        this.currentScene = new sceneClass(this.engine);
        this.currentScene.init();
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
