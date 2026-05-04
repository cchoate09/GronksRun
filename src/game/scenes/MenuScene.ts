import { Scene } from '../../engine/scenes/SceneManager';
import { GameEngine } from '../../engine/GameEngine';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GameScene, LEVELS } from './GameScene';
import { readNumber } from '../storage';

type MenuMode = 'MAIN' | 'LEVEL_SELECT';

export class MenuScene extends Scene {
    private stage: Container;
    private mode: MenuMode = 'MAIN';
    private unlockedLevel: number = 1;

    constructor(engine: GameEngine) {
        super(engine);
        this.stage = new Container();
    }

    public init(): void {
        this.engine.app.stage.addChild(this.stage);
        this.unlockedLevel = Math.max(1, Math.min(LEVELS.length, readNumber('gronk_unlocked_level', 1)));
        this.drawMainMenu();
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('message', this.handleMessage as any);
        document.addEventListener('message', this.handleMessage as any);
    }

    private clear(): void {
        this.stage.removeChildren();
        this.stage.removeAllListeners();
    }

    private drawBackdrop(): void {
        const bg = new Graphics();
        bg.rect(0, 0, window.innerWidth, window.innerHeight).fill(0x0a1018);
        bg.rect(0, window.innerHeight * 0.62, window.innerWidth, window.innerHeight * 0.38).fill(0x111827);
        for (let i = 0; i < 18; i++) {
            const x = (i * 137) % Math.max(1, window.innerWidth);
            const h = 60 + ((i * 53) % 150);
            bg.rect(x, window.innerHeight * 0.62 - h, 58, h).fill(i % 2 ? 0x172033 : 0x1f2937);
            bg.rect(x + 12, window.innerHeight * 0.62 - h + 24, 8, 12).fill(0x67e8f9);
            bg.rect(x + 34, window.innerHeight * 0.62 - h + 54, 8, 12).fill(0xffd166);
        }
        this.stage.addChild(bg);
    }

    private drawMainMenu(): void {
        this.mode = 'MAIN';
        this.clear();
        this.drawBackdrop();

        const title = new Text({
            text: 'GRONK RUN',
            style: new TextStyle({
                fill: 0xffffff,
                fontSize: Math.min(72, Math.max(44, window.innerWidth * 0.07)),
                fontWeight: 'bold',
                dropShadow: { alpha: 0.55, angle: Math.PI / 6, blur: 4, color: '#000000', distance: 5 },
            }),
        });
        title.anchor.set(0.5);
        title.position.set(window.innerWidth / 2, Math.max(76, window.innerHeight * 0.2));
        this.stage.addChild(title);

        const subtitle = new Text({
            text: 'RUN  JUMP  POUND  STRIKE',
            style: new TextStyle({ fill: 0x91e5ff, fontSize: 20, fontWeight: 'bold' }),
        });
        subtitle.anchor.set(0.5);
        subtitle.position.set(window.innerWidth / 2, title.y + 58);
        this.stage.addChild(subtitle);

        const startY = Math.max(220, window.innerHeight * 0.46);
        this.addButton(window.innerWidth / 2 - 130, startY, 260, 58, 'CONTINUE', 0x44ff88, () => {
            GameScene.selectLevel(this.unlockedLevel);
            this.engine.scenes.loadScene(GameScene);
        });
        this.addButton(window.innerWidth / 2 - 130, startY + 76, 260, 54, 'LEVEL SELECT', 0x67e8f9, () => this.drawLevelSelect());
    }

    private drawLevelSelect(): void {
        this.mode = 'LEVEL_SELECT';
        this.clear();
        this.drawBackdrop();

        const title = new Text({ text: 'SELECT LEVEL', style: new TextStyle({ fill: 0xffffff, fontSize: 42, fontWeight: 'bold' }) });
        title.anchor.set(0.5);
        title.position.set(window.innerWidth / 2, 62);
        this.stage.addChild(title);

        const panel = new Graphics();
        const panelW = Math.min(820, window.innerWidth - 40);
        const panelX = (window.innerWidth - panelW) / 2;
        panel.roundRect(panelX, 110, panelW, Math.max(260, window.innerHeight - 160), 10).fill(0x101822).stroke({ color: 0x2dd4bf, width: 2 });
        this.stage.addChild(panel);

        const cols = window.innerWidth < 760 ? 2 : 5;
        const gap = 14;
        const buttonW = (panelW - 44 - gap * (cols - 1)) / cols;
        const buttonH = 74;
        LEVELS.forEach((level, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = panelX + 22 + col * (buttonW + gap);
            const y = 134 + row * (buttonH + gap);
            const color = level.id <= this.unlockedLevel ? 0x44ff88 : 0x67e8f9;
            this.addLevelButton(x, y, buttonW, buttonH, level.id, level.name, color);
        });

        this.addButton(panelX + 22, window.innerHeight - 72, 150, 44, 'BACK', 0xffd166, () => this.drawMainMenu());
    }

    private addLevelButton(x: number, y: number, w: number, h: number, id: number, name: string, color: number): void {
        const button = new Container();
        const bg = new Graphics();
        bg.roundRect(0, 0, w, h, 8).fill(color).stroke({ color: 0xffffff, width: 1, alpha: 0.25 });
        button.addChild(bg);

        const levelText = new Text({ text: `${id}`, style: new TextStyle({ fill: 0x07110b, fontSize: 26, fontWeight: 'bold' }) });
        levelText.position.set(12, 9);
        button.addChild(levelText);

        const nameText = new Text({ text: name.toUpperCase(), style: new TextStyle({ fill: 0x07110b, fontSize: 12, fontWeight: 'bold', wordWrap: true, wordWrapWidth: w - 20 }) });
        nameText.position.set(12, 43);
        button.addChild(nameText);

        button.position.set(x, y);
        button.eventMode = 'static';
        button.cursor = 'pointer';
        button.on('pointerdown', () => {
            GameScene.selectLevel(id);
            this.engine.scenes.loadScene(GameScene);
        });
        this.stage.addChild(button);
    }

    private addButton(x: number, y: number, w: number, h: number, label: string, color: number, onClick: () => void): void {
        const button = new Container();
        const bg = new Graphics();
        bg.roundRect(0, 0, w, h, 10).fill(color);
        button.addChild(bg);

        const text = new Text({ text: label, style: new TextStyle({ fill: 0x07110b, fontSize: 20, fontWeight: 'bold' }) });
        text.anchor.set(0.5);
        text.position.set(w / 2, h / 2);
        button.addChild(text);

        button.position.set(x, y);
        button.eventMode = 'static';
        button.cursor = 'pointer';
        button.on('pointerdown', onClick);
        this.stage.addChild(button);
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (this.mode === 'MAIN' && (e.code === 'Space' || e.code === 'Enter')) {
            this.engine.input.suppressKey(e.code);
            this.engine.input.clearActions();
            GameScene.selectLevel(this.unlockedLevel);
            this.engine.scenes.loadScene(GameScene);
        } else if (this.mode === 'LEVEL_SELECT' && e.code === 'Escape') {
            this.drawMainMenu();
        }
    };

    private handleMessage = (e: any) => {
        try {
            const rawData = e.data || e;
            const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            if (data.type === 'action' && (data.name === 'jump' || data.name === 'attack')) {
                this.engine.input.clearActions();
                GameScene.selectLevel(this.unlockedLevel);
                this.engine.scenes.loadScene(GameScene);
            }
        } catch (error) {
            console.error('Failed to parse menu message:', error);
        }
    };

    public updateLogic(dt: number): void {}
    public render(alpha: number): void {}

    public destroy(): void {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('message', this.handleMessage as any);
        document.removeEventListener('message', this.handleMessage as any);
        this.engine.app.stage.removeChild(this.stage);
        this.stage.destroy({ children: true });
    }

    public getSnapshot(): unknown {
        return {
            phase: this.mode === 'MAIN' ? 'MENU' : 'LEVEL_SELECT',
            unlocked_level: this.unlockedLevel,
            levels: LEVELS.map((level) => ({
                id: level.id,
                name: level.name,
                biome: level.biome,
                target_kills: level.targetKills,
            })),
        };
    }
}
