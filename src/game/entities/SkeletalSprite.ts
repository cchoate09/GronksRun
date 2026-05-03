import { Graphics, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { SpriteSheetDefinition, SpriteState } from '../assets/spriteData';

export class SkeletalSprite extends Container {
    public head!: Graphics;
    public torso!: Graphics;
    public armL!: Graphics;
    public armR!: Graphics;
    public legL!: Graphics;
    public legR!: Graphics;
    public weapon!: Graphics;

    private time: number = 0;
    private state: SpriteState = 'IDLE';
    private _tint: number = 0xffffff;
    private sheet?: SpriteSheetDefinition;
    private sheetSprite?: Sprite;
    private frames: Texture[] = [];
    private frameIndex: number = 0;

    constructor(color: number = 0x4488ff, sheet?: SpriteSheetDefinition) {
        super();
        this.sheet = sheet;

        if (sheet) {
            const base = Texture.from(sheet.image);
            const frameW = sheet.width / sheet.cols;
            const frameH = sheet.height / sheet.rows;

            for (let i = 0; i < sheet.cols * sheet.rows; i++) {
                const col = i % sheet.cols;
                const row = Math.floor(i / sheet.cols);
                this.frames.push(new Texture({
                    source: base.source,
                    frame: new Rectangle(col * frameW, row * frameH, frameW, frameH),
                }));
            }

            this.sheetSprite = new Sprite(this.frames[0]);
            this.sheetSprite.anchor.set(0.5, 1);
            this.sheetSprite.position.set(20, 82);
            this.sheetSprite.scale.set(sheet.scale);
            this.addChild(this.sheetSprite);
            return;
        }

        this.torso = this.createPart(0, 0, 30, 40, color);
        this.head = this.createPart(5, -25, 20, 20, color);
        
        this.legL = this.createPart(5, 40, 10, 20, color);
        this.legR = this.createPart(15, 40, 10, 20, color);
        
        this.armL = this.createPart(-10, 5, 10, 25, color);
        this.armR = this.createPart(30, 5, 10, 25, color);
        
        // Better sword-like weapon
        this.weapon = new Graphics();
        this.weapon.rect(0, 0, 10, 50).fill(0xcccccc);
        this.weapon.rect(-5, 40, 20, 5).fill(0x888888); // Guard
        this.weapon.rect(2, 45, 6, 15).fill(0x664422); // Handle
        this.weapon.position.set(35, 10);
        this.weapon.pivot.set(5, 50);
        this.weapon.visible = false;

        this.addChild(this.legL, this.legR, this.torso, this.head, this.armL, this.armR, this.weapon);
    }

    public get tint(): number { return this._tint; }
    public set tint(value: number) {
        this._tint = value;
        if (this.sheetSprite) {
            this.sheetSprite.tint = value;
            return;
        }
        this.torso.tint = value;
        this.head.tint = value;
        this.legL.tint = value;
        this.legR.tint = value;
        this.armL.tint = value;
        this.armR.tint = value;
    }

    private createPart(x: number, y: number, w: number, h: number, color: number): Graphics {
        const g = new Graphics();
        g.rect(0, 0, w, h).fill(color);
        g.position.set(x, y);
        // Set pivot to center for easier rotation
        g.pivot.set(w / 2, 0);
        return g;
    }

    public setState(state: SpriteState) {
        this.state = state;
        if (this.weapon) this.weapon.visible = state === 'ATTACK';
    }

    public update(dt: number, speedScale: number = 1): void {
        this.time += dt * speedScale;

        if (this.sheet && this.sheetSprite) {
            const animation = this.sheet.animations[this.state] || this.sheet.animations.IDLE;
            const fps = Math.max(1, this.sheet.fps * Math.max(0.7, speedScale));
            this.frameIndex = Math.floor(this.time * fps) % animation.length;
            this.sheetSprite.texture = this.frames[animation[this.frameIndex]] || this.frames[0];

            if (this.state === 'ATTACK') {
                this.sheetSprite.rotation = Math.sin(this.time * 28) * 0.04;
            } else {
                this.sheetSprite.rotation = 0;
            }
            return;
        }

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
