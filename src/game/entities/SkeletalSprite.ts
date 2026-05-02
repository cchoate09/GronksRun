import { Graphics, Container } from 'pixi.js';

export class SkeletalSprite extends Container {
    public head: Graphics;
    public torso: Graphics;
    public armL: Graphics;
    public armR: Graphics;
    public legL: Graphics;
    public legR: Graphics;
    public weapon: Graphics;

    private time: number = 0;
    private state: 'IDLE' | 'RUN' | 'ATTACK' = 'IDLE';

    constructor(color: number = 0x4488ff) {
        super();

        this.torso = this.createPart(0, 0, 30, 40, color);
        this.head = this.createPart(5, -25, 20, 20, color);
        
        this.legL = this.createPart(5, 40, 10, 20, color);
        this.legR = this.createPart(15, 40, 10, 20, color);
        
        this.armL = this.createPart(-10, 5, 10, 25, color);
        this.armR = this.createPart(30, 5, 10, 25, color);
        
        this.weapon = this.createPart(35, 10, 40, 10, 0xcccccc);
        this.weapon.visible = false;

        this.addChild(this.legL, this.legR, this.torso, this.head, this.armL, this.armR, this.weapon);
    }

    private createPart(x: number, y: number, w: number, h: number, color: number): Graphics {
        const g = new Graphics();
        g.rect(0, 0, w, h).fill(color);
        g.position.set(x, y);
        // Set pivot to center for easier rotation
        g.pivot.set(w / 2, 0);
        return g;
    }

    public setState(state: 'IDLE' | 'RUN' | 'ATTACK') {
        this.state = state;
        this.weapon.visible = state === 'ATTACK';
    }

    public update(dt: number, speedScale: number = 1): void {
        this.time += dt * speedScale;

        if (this.state === 'RUN') {
            const bounce = Math.abs(Math.sin(this.time * 15)) * 5;
            this.torso.y = -bounce;
            this.head.y = -25 - bounce * 1.2;
            
            this.legL.rotation = Math.sin(this.time * 15) * 0.8;
            this.legR.rotation = Math.sin(this.time * 15 + Math.PI) * 0.8;
            
            this.armL.rotation = Math.sin(this.time * 15 + Math.PI) * 0.5;
            this.armR.rotation = Math.sin(this.time * 15) * 0.5;
        } else if (this.state === 'IDLE') {
            const breath = Math.sin(this.time * 4) * 2;
            this.torso.scale.y = 1 + breath * 0.02;
            this.head.y = -25 + breath;
            
            this.legL.rotation = 0;
            this.legR.rotation = 0;
            this.armL.rotation = breath * 0.05;
            this.armR.rotation = -breath * 0.05;
        } else if (this.state === 'ATTACK') {
            this.armR.rotation = -Math.PI / 2;
            this.weapon.rotation = Math.sin(this.time * 20) * 0.2;
        }
    }
}
