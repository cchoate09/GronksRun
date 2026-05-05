import { Scene } from '../../engine/scenes/SceneManager';
import { GameEngine } from '../../engine/GameEngine';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GameScene, LEVELS } from './GameScene';
import { readNumber, writeNumber } from '../storage';
import { SoundManager } from '../audio/SoundManager';
import { getMainMenuLayout, MainMenuButtonLayout } from './menuLayout';
import { equipWeapon, getWeaponInventorySnapshot, purchaseWeaponUpgrade, WeaponDefinition, WeaponSlot, WeaponUpgradeSnapshot } from '../weapons';

type MenuMode = 'MAIN' | 'LEVEL_SELECT' | 'SETTINGS' | 'ARMORY';

interface MenuButtonSnapshot {
    label: string;
    mode: MenuMode;
    x: number;
    y: number;
    w: number;
    h: number;
    enabled: boolean;
}

export class MenuScene extends Scene {
    private stage: Container;
    private mode: MenuMode = 'MAIN';
    private unlockedLevel: number = 1;
    private difficulty: number = 1;
    private soundEnabled: number = 1;
    private gems: number = 0;
    private mainMenuButtons: MainMenuButtonLayout[] = [];
    private buttonRegistry: MenuButtonSnapshot[] = [];

    constructor(engine: GameEngine) {
        super(engine);
        this.stage = new Container();
    }

    public init(): void {
        this.engine.app.stage.addChild(this.stage);
        this.unlockedLevel = Math.max(1, Math.min(LEVELS.length, readNumber('gronk_unlocked_level', 1)));
        this.difficulty = Math.max(0, Math.min(2, readNumber('gronk_difficulty', 1)));
        this.soundEnabled = readNumber('gronk_sound_enabled', 1) ? 1 : 0;
        this.gems = Math.max(0, readNumber('gronk_gems', 0));
        this.drawMainMenu();
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('message', this.handleMessage as any);
        document.addEventListener('message', this.handleMessage as any);
    }

    private clear(): void {
        this.stage.removeChildren();
        this.stage.removeAllListeners();
        this.buttonRegistry = [];
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
        this.publishNativeUiState(false);
        const layout = getMainMenuLayout(window.innerWidth, window.innerHeight);
        this.mainMenuButtons = layout.buttons;

        const title = new Text({
            text: 'GRONK RUN',
            style: new TextStyle({
                fill: 0xffffff,
                fontSize: layout.titleFontSize,
                fontWeight: 'bold',
                dropShadow: { alpha: 0.55, angle: Math.PI / 6, blur: 4, color: '#000000', distance: 5 },
            }),
        });
        title.anchor.set(0.5);
        title.position.set(window.innerWidth / 2, layout.titleY);
        this.stage.addChild(title);

        const subtitle = new Text({
            text: 'RUN  JUMP  POUND  STRIKE',
            style: new TextStyle({ fill: 0x91e5ff, fontSize: layout.subtitleFontSize, fontWeight: 'bold' }),
        });
        subtitle.anchor.set(0.5);
        subtitle.position.set(window.innerWidth / 2, layout.subtitleY);
        this.stage.addChild(subtitle);

        const buttonsByLabel = new Map(layout.buttons.map((button) => [button.label, button]));
        const continueButton = buttonsByLabel.get('CONTINUE')!;
        this.addButton(continueButton.x, continueButton.y, continueButton.w, continueButton.h, 'CONTINUE', 0x44ff88, () => {
            GameScene.selectLevel(this.unlockedLevel);
            this.engine.scenes.loadScene(GameScene);
        });
        const endlessButton = buttonsByLabel.get('ENDLESS RUN')!;
        this.addButton(endlessButton.x, endlessButton.y, endlessButton.w, endlessButton.h, 'ENDLESS RUN', 0xffd166, () => {
            GameScene.selectLevel(0);
            this.engine.scenes.loadScene(GameScene);
        });
        const armoryButton = buttonsByLabel.get('ARMORY')!;
        this.addButton(armoryButton.x, armoryButton.y, armoryButton.w, armoryButton.h, 'ARMORY', 0xfca5a5, () => this.drawArmory());
        const levelButton = buttonsByLabel.get('LEVEL SELECT')!;
        this.addButton(levelButton.x, levelButton.y, levelButton.w, levelButton.h, 'LEVEL SELECT', 0x67e8f9, () => this.drawLevelSelect());
        const settingsButton = buttonsByLabel.get('SETTINGS')!;
        this.addButton(settingsButton.x, settingsButton.y, settingsButton.w, settingsButton.h, 'SETTINGS', 0xc4b5fd, () => this.drawSettings());
    }

    private drawLevelSelect(): void {
        this.mode = 'LEVEL_SELECT';
        this.clear();
        this.drawBackdrop();
        this.publishNativeUiState(false);

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

    private drawSettings(): void {
        this.mode = 'SETTINGS';
        this.clear();
        this.drawBackdrop();
        this.publishNativeUiState(false);

        const title = new Text({ text: 'SETTINGS', style: new TextStyle({ fill: 0xffffff, fontSize: 42, fontWeight: 'bold' }) });
        title.anchor.set(0.5);
        title.position.set(window.innerWidth / 2, 66);
        this.stage.addChild(title);

        const panelW = Math.min(680, window.innerWidth - 44);
        const panelX = (window.innerWidth - panelW) / 2;
        const panelY = 124;
        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, Math.max(270, window.innerHeight - 184), 10).fill(0x101822).stroke({ color: 0xc4b5fd, width: 2 });
        this.stage.addChild(panel);

        this.addSettingLabel(panelX + 32, panelY + 36, 'DIFFICULTY');
        const labels = ['EASY', 'NORMAL', 'HARD'];
        labels.forEach((label, index) => {
            this.addButton(panelX + 32 + index * 148, panelY + 70, 128, 46, label, this.difficulty === index ? 0x44ff88 : 0x67e8f9, () => {
                this.difficulty = index;
                writeNumber('gronk_difficulty', this.difficulty);
                this.drawSettings();
            });
        });

        this.addSettingLabel(panelX + 32, panelY + 150, 'SOUND');
        this.addButton(panelX + 32, panelY + 184, 180, 48, this.soundEnabled ? 'SOUND ON' : 'SOUND OFF', this.soundEnabled ? 0x44ff88 : 0xff7a45, () => {
            this.soundEnabled = this.soundEnabled ? 0 : 1;
            writeNumber('gronk_sound_enabled', this.soundEnabled);
            this.drawSettings();
        });

        this.addButton(panelX + 32, window.innerHeight - 72, 150, 44, 'BACK', 0xffd166, () => this.drawMainMenu());
    }

    private drawArmory(): void {
        this.mode = 'ARMORY';
        this.clear();
        this.drawBackdrop();
        this.publishNativeUiState(false);
        this.gems = Math.max(0, readNumber('gronk_gems', 0));

        const title = new Text({ text: 'ARMORY', style: new TextStyle({ fill: 0xffffff, fontSize: 42, fontWeight: 'bold' }) });
        title.anchor.set(0.5);
        title.position.set(window.innerWidth / 2, 62);
        this.stage.addChild(title);

        const inventory = getWeaponInventorySnapshot();
        const panelW = Math.min(860, window.innerWidth - 40);
        const panelH = Math.max(270, window.innerHeight - 154);
        const panelX = (window.innerWidth - panelW) / 2;
        const panelY = 104;
        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 10).fill(0x101822).stroke({ color: 0xfca5a5, width: 2 });
        this.stage.addChild(panel);

        const gemText = new Text({ text: `GEMS ${this.gems}`, style: new TextStyle({ fill: 0xffd166, fontSize: 18, fontWeight: 'bold' }) });
        gemText.anchor.set(1, 0);
        gemText.position.set(panelX + panelW - 24, panelY + 18);
        this.stage.addChild(gemText);

        const columnGap = 18;
        const columnW = (panelW - 52 - columnGap) / 2;
        this.drawWeaponColumn('MELEE', 'melee', inventory.melee, inventory.ownedMelee, inventory.equippedMelee, inventory.meleeUpgrade, panelX + 22, panelY + 28, columnW);
        this.drawWeaponColumn('RANGED', 'ranged', inventory.ranged, inventory.ownedRanged, inventory.equippedRanged, inventory.rangedUpgrade, panelX + 30 + columnW + columnGap, panelY + 28, columnW);

        this.addButton(panelX + 22, window.innerHeight - 72, 150, 44, 'BACK', 0xffd166, () => this.drawMainMenu());
    }

    private drawWeaponColumn(title: string, slot: WeaponSlot, weapons: WeaponDefinition[], owned: string[], equipped: string, upgrade: WeaponUpgradeSnapshot, x: number, y: number, w: number): void {
        const titleText = new Text({ text: title, style: new TextStyle({ fill: 0x91e5ff, fontSize: 18, fontWeight: 'bold' }) });
        titleText.position.set(x, y);
        this.stage.addChild(titleText);

        weapons.forEach((weapon, index) => {
            const itemY = y + 34 + index * 54;
            const isOwned = owned.includes(weapon.id);
            const isEquipped = equipped === weapon.id;
            const color = isEquipped ? 0x44ff88 : isOwned ? 0x67e8f9 : 0x334155;
            const button = new Container();
            button.addChild(this.drawButtonChrome(w, 46, color, isOwned ? 1 : 0.42));

            const label = isEquipped ? `${weapon.name.toUpperCase()}  EQUIPPED` : isOwned ? weapon.name.toUpperCase() : `${weapon.name.toUpperCase()}  LV ${weapon.unlockLevel}`;
            const nameText = new Text({ text: label, style: new TextStyle({ fill: isOwned ? 0x07110b : 0xcbd5e1, fontSize: 13, fontWeight: 'bold' }) });
            nameText.position.set(12, 7);
            button.addChild(nameText);

            const statText = new Text({
                text: title === 'MELEE'
                    ? `DMG ${weapon.damage}  RANGE ${weapon.range}`
                    : `DMG ${weapon.damage}  CD ${weapon.cooldown.toFixed(2)}  SPD ${weapon.projectileSpeed}`,
                style: new TextStyle({ fill: isOwned ? 0x172033 : 0x94a3b8, fontSize: 11, fontWeight: 'bold' }),
            });
            statText.position.set(12, 26);
            button.addChild(statText);

            button.position.set(x, itemY);
            button.eventMode = isOwned ? 'static' : 'none';
            button.cursor = isOwned ? 'pointer' : 'default';
            this.registerButton(label, x, itemY, w, 46, isOwned);
            if (isOwned) {
                button.on('pointerdown', () => {
                    SoundManager.playCue('select');
                    equipWeapon(weapon.id);
                    this.drawArmory();
                });
            }
            this.stage.addChild(button);
        });

        const upgradeCost = upgrade.upgradeCost;
        const upgradeLabel = upgradeCost == null ? `${title} +${upgrade.level} MAX` : `${title} +${upgrade.level + 1}  ${upgradeCost} GEMS`;
        const upgradeY = y + 34 + weapons.length * 54 + 10;
        const canBuy = upgradeCost != null && this.gems >= upgradeCost;
        const button = new Container();
        button.addChild(this.drawButtonChrome(w, 48, canBuy ? 0xffd166 : 0x475569, canBuy ? 1 : 0.5));
        const upgradeText = new Text({
            text: upgradeLabel,
            style: new TextStyle({ fill: canBuy ? 0x07110b : 0xcbd5e1, fontSize: 13, fontWeight: 'bold', wordWrap: true, wordWrapWidth: w - 24 }),
        });
        upgradeText.anchor.set(0.5);
        upgradeText.position.set(w / 2, 16);
        button.addChild(upgradeText);
        const statText = new Text({
            text: slot === 'melee'
                ? `DMG x${upgrade.damageMultiplier}  RANGE BOOST`
                : `DMG x${upgrade.damageMultiplier}  FASTER SHOTS`,
            style: new TextStyle({ fill: canBuy ? 0x172033 : 0x94a3b8, fontSize: 10, fontWeight: 'bold' }),
        });
        statText.anchor.set(0.5);
        statText.position.set(w / 2, 34);
        button.addChild(statText);
        button.position.set(x, upgradeY);
        button.eventMode = upgradeCost == null ? 'none' : 'static';
        button.cursor = upgradeCost == null ? 'default' : 'pointer';
        this.registerButton(upgradeLabel, x, upgradeY, w, 48, upgradeCost != null);
        if (upgradeCost != null) {
            button.on('pointerdown', () => {
                const result = purchaseWeaponUpgrade(slot, this.gems);
                this.gems = result.gems;
                SoundManager.playCue(result.purchased ? 'clear' : 'damage');
                this.drawArmory();
            });
        }
        this.stage.addChild(button);
    }

    private addSettingLabel(x: number, y: number, label: string): void {
        const text = new Text({ text: label, style: new TextStyle({ fill: 0x91e5ff, fontSize: 18, fontWeight: 'bold' }) });
        text.position.set(x, y);
        this.stage.addChild(text);
    }

    private addLevelButton(x: number, y: number, w: number, h: number, id: number, name: string, color: number): void {
        const button = new Container();
        button.addChild(this.drawButtonChrome(w, h, color));

        const levelText = new Text({ text: `${id}`, style: new TextStyle({ fill: 0x07110b, fontSize: 26, fontWeight: 'bold' }) });
        levelText.position.set(12, 9);
        button.addChild(levelText);

        const nameText = new Text({ text: name.toUpperCase(), style: new TextStyle({ fill: 0x07110b, fontSize: 12, fontWeight: 'bold', wordWrap: true, wordWrapWidth: w - 20 }) });
        nameText.position.set(12, 43);
        button.addChild(nameText);

        button.position.set(x, y);
        button.eventMode = 'static';
        button.cursor = 'pointer';
        this.registerButton(`LEVEL ${id}`, x, y, w, h, true);
        button.on('pointerdown', () => {
            SoundManager.playCue('select');
            GameScene.selectLevel(id);
            this.engine.scenes.loadScene(GameScene);
        });
        this.stage.addChild(button);
    }

    private addButton(x: number, y: number, w: number, h: number, label: string, color: number, onClick: () => void): void {
        const button = new Container();
        button.addChild(this.drawButtonChrome(w, h, color));

        const text = new Text({ text: label, style: new TextStyle({ fill: 0x07110b, fontSize: 20, fontWeight: 'bold' }) });
        text.anchor.set(0.5);
        text.position.set(w / 2, h / 2);
        button.addChild(text);

        button.position.set(x, y);
        button.eventMode = 'static';
        button.cursor = 'pointer';
        this.registerButton(label, x, y, w, h, true);
        button.on('pointerdown', () => {
            SoundManager.playCue('select');
            onClick();
        });
        this.stage.addChild(button);
    }

    private drawButtonChrome(w: number, h: number, color: number, intensity: number = 1): Graphics {
        const bg = new Graphics();
        bg.roundRect(3, 5, w, h, 10).fill({ color: 0x020617, alpha: 0.52 * intensity });
        bg.roundRect(0, 0, w, h, 10).fill({ color, alpha: 0.92 * intensity }).stroke({ color: 0xffffff, width: 2, alpha: 0.28 * intensity });
        bg.roundRect(5, 5, w - 10, Math.max(8, h * 0.32), 7).fill({ color: 0xffffff, alpha: 0.16 * intensity });
        bg.rect(8, h - 7, w - 16, 3).fill({ color: 0x07110b, alpha: 0.22 * intensity });
        bg.circle(13, h * 0.5, 3).fill({ color: 0x07110b, alpha: 0.25 * intensity });
        bg.circle(w - 13, h * 0.5, 3).fill({ color: 0x07110b, alpha: 0.25 * intensity });
        return bg;
    }

    private registerButton(label: string, x: number, y: number, w: number, h: number, enabled: boolean): void {
        this.buttonRegistry.push({
            label,
            mode: this.mode,
            x: Math.round(x),
            y: Math.round(y),
            w: Math.round(w),
            h: Math.round(h),
            enabled,
        });
    }

    private publishNativeUiState(controlsVisible: boolean): void {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'gameUiState',
            phase: this.mode === 'MAIN' ? 'MENU' : this.mode,
            controlsVisible,
        }));
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (this.mode === 'MAIN' && (e.code === 'Space' || e.code === 'Enter')) {
            this.engine.input.suppressKey(e.code);
            this.engine.input.clearActions();
            GameScene.selectLevel(this.unlockedLevel);
            this.engine.scenes.loadScene(GameScene);
        } else if ((this.mode === 'LEVEL_SELECT' || this.mode === 'SETTINGS' || this.mode === 'ARMORY') && e.code === 'Escape') {
            this.drawMainMenu();
        }
    };

    private handleMessage = (e: any) => {
        try {
            const rawData = e.data || e;
            const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            if (data.type === 'backButton') {
                if (this.mode === 'MAIN') {
                    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'exitApp' }));
                } else {
                    this.drawMainMenu();
                }
                return;
            }
            if (this.mode === 'MAIN' && data.type === 'action' && (data.name === 'jump' || data.name === 'attack')) {
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
            phase: this.mode === 'MAIN' ? 'MENU' : this.mode,
            main_menu_buttons: this.mode === 'MAIN'
                ? this.mainMenuButtons.map((button) => ({
                    label: button.label,
                    x: Math.round(button.x),
                    y: Math.round(button.y),
                    w: Math.round(button.w),
                    h: Math.round(button.h),
                }))
                : [],
            buttons: this.buttonRegistry,
            settings: {
                difficulty: this.difficulty,
                sound_enabled: this.soundEnabled === 1,
            },
            armory: getWeaponInventorySnapshot(),
            gems: this.gems,
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
