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
    private runStrideCue: Graphics;
    private rangedAttackCue: Graphics;
    private rangedCueVisible: boolean = false;
    private rangedCueProgress: number = 0;
    private frames: Texture[] = [];
    private frameIndex: number = 0;
    private currentFrame: number = 0;
    private baseSpriteX: number = 20;
    private baseSpriteY: number = 82;

    constructor(color: number = 0x4488ff, sheet?: SpriteSheetDefinition) {
        super();
        this.sheet = sheet;
        this.runStrideCue = new Graphics();
        this.rangedAttackCue = new Graphics();
        this.runStrideCue.visible = false;
        this.rangedAttackCue.visible = false;

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
            this.sheetSprite.anchor.set(sheet.anchorX ?? 0.5, sheet.anchorY ?? 1);
            this.baseSpriteX = sheet.spriteOffsetX ?? 20;
            this.baseSpriteY = sheet.spriteOffsetY ?? 82;
            this.sheetSprite.position.set(this.baseSpriteX, this.baseSpriteY);
            this.sheetSprite.scale.set(sheet.scale);
            this.addChild(this.runStrideCue, this.sheetSprite, this.rangedAttackCue);
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

        this.addChild(this.runStrideCue, this.legL, this.legR, this.torso, this.head, this.armL, this.armR, this.weapon, this.rangedAttackCue);
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

    public get animationState(): SpriteState {
        return this.state;
    }

    public get animationFrame(): number {
        return this.currentFrame;
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

    public setRangedAttackCue(visible: boolean, progress: number = 0): void {
        this.rangedCueVisible = visible;
        this.rangedCueProgress = Math.max(0, Math.min(1, progress));
    }

    public setFacingRight(facingRight: boolean, bodyWidth: number): void {
        const sourceFacesRight = this.sheet?.facesRight ?? true;
        const shouldFlip = facingRight !== sourceFacesRight;
        this.scale.x = shouldFlip ? -1 : 1;
        this.x = shouldFlip ? bodyWidth : 0;
    }

    public update(dt: number, speedScale: number = 1): void {
        this.time += dt;
        const animationRateScale = Math.min(1.55, Math.max(0.72, Number.isFinite(speedScale) ? speedScale : 1));

        if (this.sheet && this.sheetSprite) {
            const animation = this.sheet.animations[this.state] || this.sheet.animations.IDLE;
            const fps = Math.max(1, this.sheet.fps * animationRateScale);
            this.frameIndex = Math.floor(this.time * fps) % animation.length;
            this.currentFrame = animation[this.frameIndex] ?? 0;
            this.sheetSprite.texture = this.frames[this.currentFrame] || this.frames[0];

            if (this.state === 'RUN') {
                const phase = this.time * fps * Math.PI * 2 / Math.max(1, animation.length);
                const bounce = Math.abs(Math.sin(phase)) * 1.25;
                const stride = Math.sin(phase) * 1.1;
                this.applyFrameOffset(this.baseSpriteX + stride, this.baseSpriteY - bounce);
                this.sheetSprite.rotation = Math.sin(phase) * 0.025;
                this.drawRunStrideCues(true, phase);
            } else if (this.state === 'ATTACK') {
                this.applyFrameOffset(this.baseSpriteX, this.baseSpriteY);
                this.sheetSprite.rotation = Math.sin(this.time * 28) * 0.04;
                this.drawRunStrideCues(false, 0);
            } else if (this.state === 'RANGED_ATTACK') {
                this.applyFrameOffset(this.baseSpriteX + 2, this.baseSpriteY - 1);
                this.sheetSprite.rotation = -0.035 + Math.sin(this.time * 20) * 0.025;
                this.drawRunStrideCues(false, 0);
            } else if (this.state === 'JUMP') {
                this.applyFrameOffset(this.baseSpriteX, this.baseSpriteY - 3);
                this.sheetSprite.rotation = -0.035;
                this.drawRunStrideCues(false, 0);
            } else if (this.state === 'FALL') {
                this.applyFrameOffset(this.baseSpriteX, this.baseSpriteY + 1);
                this.sheetSprite.rotation = 0.03;
                this.drawRunStrideCues(false, 0);
            } else {
                const breath = this.state === 'IDLE' ? Math.sin(this.time * 4) * 1.2 : 0;
                this.applyFrameOffset(this.baseSpriteX, this.baseSpriteY + breath);
                this.sheetSprite.rotation = 0;
                this.drawRunStrideCues(false, 0);
            }
            this.drawRangedAttackCue(this.rangedCueVisible, this.rangedCueProgress);
            return;
        }

        if (this.state === 'RUN') {
            const phase = this.time * 15 * animationRateScale;
            const bounce = Math.abs(Math.sin(phase)) * 5;
            this.torso.y = -bounce;
            this.head.y = -25 - bounce * 1.2;
            
            this.legL.rotation = Math.sin(phase) * 0.8;
            this.legR.rotation = Math.sin(phase + Math.PI) * 0.8;
            
            this.armL.rotation = Math.sin(phase + Math.PI) * 0.5;
            this.armR.rotation = Math.sin(phase) * 0.5;
            this.drawRunStrideCues(true, phase);
        } else if (this.state === 'IDLE') {
            const breath = Math.sin(this.time * 4) * 2;
            this.torso.scale.y = 1 + breath * 0.02;
            this.head.y = -25 + breath;
            
            this.legL.rotation = 0;
            this.legR.rotation = 0;
            this.armL.rotation = breath * 0.05;
            this.armR.rotation = -breath * 0.05;
            this.drawRunStrideCues(false, 0);
        } else if (this.state === 'ATTACK') {
            this.armR.rotation = -Math.PI / 2;
            this.weapon.rotation = Math.sin(this.time * 20) * 0.2;
            this.drawRunStrideCues(false, 0);
        } else if (this.state === 'RANGED_ATTACK') {
            this.armR.rotation = -0.85;
            this.armL.rotation = -0.35;
            this.drawRunStrideCues(false, 0);
        } else if (this.state === 'JUMP') {
            this.torso.y = -3;
            this.head.y = -30;
            this.legL.rotation = -0.25;
            this.legR.rotation = 0.25;
            this.armL.rotation = -0.2;
            this.armR.rotation = 0.35;
            this.drawRunStrideCues(false, 0);
        } else if (this.state === 'FALL') {
            this.torso.y = 1;
            this.head.y = -23;
            this.legL.rotation = 0.2;
            this.legR.rotation = -0.2;
            this.armL.rotation = 0.35;
            this.armR.rotation = -0.25;
            this.drawRunStrideCues(false, 0);
        }
        this.drawRangedAttackCue(this.rangedCueVisible, this.rangedCueProgress);
    }

    private applyFrameOffset(x: number, y: number): void {
        if (!this.sheetSprite) return;
        const offset = this.sheet?.frameOffsets?.[this.currentFrame];
        this.sheetSprite.position.set(x + (offset?.x ?? 0), y + (offset?.y ?? 0));
    }

    private drawRunStrideCues(visible: boolean, phase: number): void {
        this.runStrideCue.clear();
        this.runStrideCue.visible = visible;
        if (!visible) return;

        const stride = Math.sin(phase);
        const backStride = Math.sin(phase + Math.PI);
        const hipX = this.baseSpriteX;
        const hipY = this.baseSpriteY - 42;
        const footY = this.baseSpriteY - 3;
        const frontFootX = hipX + 13 + stride * 14;
        const rearFootX = hipX - 9 + backStride * 13;

        this.runStrideCue.moveTo(hipX - 4, hipY)
            .quadraticCurveTo(hipX - 11 + stride * 5, hipY + 22, frontFootX, footY)
            .stroke({ color: 0x07110b, width: 6, alpha: 0.62 });
        this.runStrideCue.moveTo(hipX + 6, hipY + 2)
            .quadraticCurveTo(hipX + 13 + backStride * 5, hipY + 24, rearFootX, footY)
            .stroke({ color: 0x1f2937, width: 5, alpha: 0.58 });
        this.runStrideCue.ellipse(frontFootX + 4, footY + 2, 12, 4).fill({ color: 0xffd166, alpha: 0.74 });
        this.runStrideCue.ellipse(rearFootX - 3, footY + 4, 10, 3).fill({ color: 0x67e8f9, alpha: 0.48 });
    }

    private drawRangedAttackCue(visible: boolean, progress: number): void {
        this.rangedAttackCue.clear();
        this.rangedAttackCue.visible = visible;
        if (!visible) return;

        const pulse = Math.sin(progress * Math.PI);
        const handX = this.baseSpriteX + 28;
        const handY = this.baseSpriteY - 48;
        const reach = 34 + pulse * 10;

        this.rangedAttackCue.moveTo(handX - 6, handY - 12)
            .quadraticCurveTo(handX + 13, handY - 28, handX + 26, handY - 5)
            .stroke({ color: 0x91e5ff, width: 4, alpha: 0.82 });
        this.rangedAttackCue.moveTo(handX, handY)
            .lineTo(handX + reach, handY - 2)
            .stroke({ color: 0xffffff, width: 3, alpha: 0.9 });
        this.rangedAttackCue.circle(handX + reach + 3, handY - 2, 5 + pulse * 5).fill({ color: 0x67e8f9, alpha: 0.62 });
        this.rangedAttackCue.circle(handX + reach + 3, handY - 2, 2 + pulse * 2).fill({ color: 0xffffff, alpha: 0.86 });
    }
}
