import { Scene } from '../../engine/scenes/SceneManager';
import { GameEngine } from '../../engine/GameEngine';
import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { GameScene, LEVELS } from './GameScene';
import { readNumber, writeNumber } from '../storage';
import { SoundManager } from '../audio/SoundManager';
import { getMainMenuLayout, MainMenuButtonLayout } from './menuLayout';
import { equipWeapon, getWeaponInventorySnapshot, purchaseWeaponUpgrade, WeaponDefinition, WeaponSlot, WeaponUpgradeSnapshot } from '../weapons';
import mainMenuHero from '../../../assets/backgrounds/main-menu-hero.png';

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

interface MenuSurfaceSnapshot {
    name: string;
    mode: MenuMode;
    x: number;
    y: number;
    w: number;
    h: number;
}

interface WeaponColumnLayout {
    itemH: number;
    itemGap: number;
    titleGap: number;
    upgradeH: number;
    upgradeGap: number;
    titleFont: number;
    nameFont: number;
    statFont: number;
    compact: boolean;
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
    private surfaceRegistry: MenuSurfaceSnapshot[] = [];
    private levelSelectPage: number = 0;

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
        this.surfaceRegistry = [];
    }

    // Async by design even though the body is empty today: forces every
    // call site to `await` it, so when a future async persistence layer
    // (IndexedDB, cloud save) is wired in here, the safeToExit handshake
    // can't accidentally fire before the write resolves. Type system
    // enforces the contract.
    private async flushPersistence(): Promise<void> {
        // localStorage is synchronous in the WebView, so this is a no-op today.
    }

    private drawBackdrop(): void {
        const art = Sprite.from(mainMenuHero);
        const textureW = 1536;
        const textureH = 864;
        const scale = Math.max(window.innerWidth / textureW, window.innerHeight / textureH);
        art.width = textureW * scale;
        art.height = textureH * scale;
        art.x = (window.innerWidth - art.width) / 2;
        art.y = (window.innerHeight - art.height) / 2;
        art.alpha = 0.92;
        this.stage.addChild(art);

        const bg = new Graphics();
        bg.rect(0, 0, window.innerWidth, window.innerHeight).fill({ color: 0x020617, alpha: 0.18 });
        bg.rect(0, 0, window.innerWidth * 0.52, window.innerHeight).fill({ color: 0x020617, alpha: 0.38 });
        bg.rect(0, window.innerHeight * 0.58, window.innerWidth, window.innerHeight * 0.42).fill({ color: 0x05070b, alpha: 0.36 });
        bg.rect(0, 0, window.innerWidth, 18).fill({ color: 0x91e5ff, alpha: 0.12 });
        bg.rect(0, window.innerHeight - 20, window.innerWidth, 20).fill({ color: 0xffd166, alpha: 0.13 });
        for (let i = 0; i < 10; i++) {
            const x = (i * 137) % Math.max(1, window.innerWidth);
            const h = 38 + ((i * 41) % 98);
            bg.rect(x, window.innerHeight * 0.66 - h, 42, h).fill({ color: i % 2 ? 0x172033 : 0x1f2937, alpha: 0.28 });
            bg.rect(x + 10, window.innerHeight * 0.66 - h + 20, 6, 10).fill({ color: 0x67e8f9, alpha: 0.44 });
            bg.rect(x + 26, window.innerHeight * 0.66 - h + 48, 6, 10).fill({ color: 0xffd166, alpha: 0.4 });
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

        const titlePlate = new Graphics();
        const plateW = Math.min(560, Math.max(360, window.innerWidth * 0.46));
        const plateH = Math.max(80, layout.subtitleY - layout.titleY + 70);
        titlePlate.roundRect(window.innerWidth / 2 - plateW / 2, layout.titleY - plateH * 0.48, plateW, plateH, 12)
            .fill({ color: 0x031525, alpha: 0.48 })
            .stroke({ color: 0x91e5ff, width: 2, alpha: 0.28 });
        titlePlate.rect(window.innerWidth / 2 - plateW * 0.42, layout.subtitleY + 18, plateW * 0.84, 3)
            .fill({ color: 0xffd166, alpha: 0.72 });
        this.stage.addChild(titlePlate);

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
        title.position.set(window.innerWidth / 2, window.innerHeight < 430 ? 44 : 62);
        this.stage.addChild(title);

        const panel = new Graphics();
        const panelW = Math.min(820, window.innerWidth - 40);
        const panelX = (window.innerWidth - panelW) / 2;
        const panelY = window.innerHeight < 430 ? 82 : 110;
        const footerY = window.innerHeight - 72;
        panel.roundRect(panelX, panelY, panelW, Math.max(220, footerY + 58 - panelY), 10).fill(0x101822).stroke({ color: 0x2dd4bf, width: 2 });
        this.stage.addChild(panel);

        const cols = window.innerWidth < 760 ? 4 : 5;
        const rows = 2;
        const perPage = cols * rows;
        const pageCount = Math.max(1, Math.ceil(LEVELS.length / perPage));
        this.levelSelectPage = Math.max(0, Math.min(pageCount - 1, this.levelSelectPage));
        const gap = 14;
        const buttonW = (panelW - 44 - gap * (cols - 1)) / cols;
        const gridY = panelY + 24;
        const buttonH = Math.min(74, Math.max(48, (footerY - gridY - 18 - gap * (rows - 1)) / rows));
        const visibleLevels = LEVELS.slice(this.levelSelectPage * perPage, this.levelSelectPage * perPage + perPage);
        visibleLevels.forEach((level, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = panelX + 22 + col * (buttonW + gap);
            const y = gridY + row * (buttonH + gap);
            const color = level.id <= this.unlockedLevel ? 0x44ff88 : 0x67e8f9;
            this.addLevelButton(x, y, buttonW, buttonH, level.id, level.name, color);
        });

        const pageText = new Text({ text: `${this.levelSelectPage + 1}/${pageCount}`, style: new TextStyle({ fill: 0x91e5ff, fontSize: 18, fontWeight: 'bold' }) });
        pageText.anchor.set(0.5);
        pageText.position.set(panelX + panelW / 2, window.innerHeight - 50);
        this.stage.addChild(pageText);

        this.addButton(panelX + 22, window.innerHeight - 72, 120, 44, 'BACK', 0xffd166, () => this.drawMainMenu());
        if (pageCount > 1) {
            this.addButton(panelX + panelW - 286, window.innerHeight - 72, 124, 44, 'PREV', 0x67e8f9, () => {
                this.levelSelectPage = (this.levelSelectPage + pageCount - 1) % pageCount;
                this.drawLevelSelect();
            });
            this.addButton(panelX + panelW - 146, window.innerHeight - 72, 124, 44, 'NEXT', 0x67e8f9, () => {
                this.levelSelectPage = (this.levelSelectPage + 1) % pageCount;
                this.drawLevelSelect();
            });
        }
    }

    private drawSettings(): void {
        this.mode = 'SETTINGS';
        this.clear();
        this.drawBackdrop();
        this.publishNativeUiState(false);

        const compact = window.innerHeight < 430 || window.innerWidth < 760;
        const title = new Text({ text: 'SETTINGS', style: new TextStyle({ fill: 0xffffff, fontSize: compact ? 30 : 42, fontWeight: 'bold' }) });
        title.anchor.set(0.5);
        title.position.set(window.innerWidth / 2, compact ? 34 : 66);
        this.stage.addChild(title);

        const backH = compact ? 38 : 44;
        const backY = window.innerHeight - (compact ? 48 : 72);
        const panelW = Math.min(compact ? 640 : 680, window.innerWidth - (compact ? 28 : 44));
        const panelX = (window.innerWidth - panelW) / 2;
        const panelY = compact ? 62 : 124;
        const panelH = Math.max(compact ? 220 : 270, backY + backH + 10 - panelY);
        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 10).fill({ color: 0x101822, alpha: 0.88 }).stroke({ color: 0xc4b5fd, width: 2 });
        this.stage.addChild(panel);
        this.registerSurface('settings-panel', panelX, panelY, panelW, panelH);

        const pad = compact ? 22 : 32;
        const buttonH = compact ? 38 : 46;
        const optionGap = compact ? 10 : 20;
        const optionW = Math.min(compact ? 150 : 128, (panelW - pad * 2 - optionGap * 2) / 3);
        const optionGroupW = optionW * 3 + optionGap * 2;
        const optionX = panelX + (panelW - optionGroupW) / 2;
        const difficultyLabelY = panelY + (compact ? 18 : 36);
        const difficultyButtonY = panelY + (compact ? 46 : 70);
        this.addSettingLabel(panelX + pad, difficultyLabelY, 'DIFFICULTY', compact ? 14 : 18);
        const labels = ['EASY', 'NORMAL', 'HARD'];
        labels.forEach((label, index) => {
            this.addButton(optionX + index * (optionW + optionGap), difficultyButtonY, optionW, buttonH, label, this.difficulty === index ? 0x44ff88 : 0x67e8f9, () => {
                this.difficulty = index;
                writeNumber('gronk_difficulty', this.difficulty);
                this.drawSettings();
            });
        });

        const soundLabelY = difficultyButtonY + buttonH + (compact ? 26 : 34);
        this.addSettingLabel(panelX + pad, soundLabelY, 'SOUND', compact ? 14 : 18);
        this.addButton(panelX + pad, soundLabelY + (compact ? 22 : 34), compact ? 160 : 180, compact ? 38 : 48, this.soundEnabled ? 'SOUND ON' : 'SOUND OFF', this.soundEnabled ? 0x44ff88 : 0xff7a45, () => {
            this.soundEnabled = this.soundEnabled ? 0 : 1;
            writeNumber('gronk_sound_enabled', this.soundEnabled);
            this.drawSettings();
        });

        this.addButton(panelX + pad, backY, compact ? 132 : 150, backH, 'BACK', 0xffd166, () => this.drawMainMenu());
    }

    private drawArmory(): void {
        this.mode = 'ARMORY';
        this.clear();
        this.drawBackdrop();
        this.publishNativeUiState(false);
        this.gems = Math.max(0, readNumber('gronk_gems', 0));

        const compact = window.innerHeight < 450 || window.innerWidth < 820;
        const title = new Text({ text: 'ARMORY', style: new TextStyle({ fill: 0xffffff, fontSize: compact ? 30 : 42, fontWeight: 'bold' }) });
        title.anchor.set(0.5);
        title.position.set(window.innerWidth / 2, compact ? 34 : 62);
        this.stage.addChild(title);

        const inventory = getWeaponInventorySnapshot();
        const backH = compact ? 38 : 44;
        const backY = window.innerHeight - (compact ? 48 : 72);
        const panelW = Math.min(compact ? 700 : 860, window.innerWidth - (compact ? 28 : 40));
        const panelH = Math.max(compact ? 226 : 270, backY - (compact ? 8 : 10) - (compact ? 58 : 104));
        const panelX = (window.innerWidth - panelW) / 2;
        const panelY = compact ? 58 : 104;
        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 10).fill({ color: 0x101822, alpha: 0.88 }).stroke({ color: 0xfca5a5, width: 2 });
        this.stage.addChild(panel);
        this.registerSurface('armory-panel', panelX, panelY, panelW, panelH);

        const gemText = new Text({ text: `GEMS ${this.gems}`, style: new TextStyle({ fill: 0xffd166, fontSize: compact ? 14 : 18, fontWeight: 'bold' }) });
        gemText.anchor.set(1, 0);
        gemText.position.set(panelX + panelW - (compact ? 18 : 24), panelY + (compact ? 12 : 18));
        this.stage.addChild(gemText);

        const columnGap = compact ? 12 : 18;
        const sidePad = compact ? 18 : 22;
        const columnW = (panelW - sidePad * 2 - columnGap) / 2;
        const columnLayout: WeaponColumnLayout = compact
            ? { itemH: 32, itemGap: 4, titleGap: 24, upgradeH: 38, upgradeGap: 6, titleFont: 14, nameFont: 10, statFont: 8, compact: true }
            : { itemH: 46, itemGap: 8, titleGap: 34, upgradeH: 48, upgradeGap: 10, titleFont: 18, nameFont: 13, statFont: 11, compact: false };
        const columnY = panelY + (compact ? 18 : 28);
        this.drawWeaponColumn('MELEE', 'melee', inventory.melee, inventory.ownedMelee, inventory.equippedMelee, inventory.meleeUpgrade, panelX + sidePad, columnY, columnW, columnLayout);
        this.drawWeaponColumn('RANGED', 'ranged', inventory.ranged, inventory.ownedRanged, inventory.equippedRanged, inventory.rangedUpgrade, panelX + sidePad + columnW + columnGap, columnY, columnW, columnLayout);

        this.addButton(panelX + sidePad, backY, compact ? 132 : 150, backH, 'BACK', 0xffd166, () => this.drawMainMenu());
    }

    private drawWeaponColumn(title: string, slot: WeaponSlot, weapons: WeaponDefinition[], owned: string[], equipped: string, upgrade: WeaponUpgradeSnapshot, x: number, y: number, w: number, layout: WeaponColumnLayout): void {
        const titleText = new Text({ text: title, style: new TextStyle({ fill: 0x91e5ff, fontSize: layout.titleFont, fontWeight: 'bold' }) });
        titleText.position.set(x, y);
        this.stage.addChild(titleText);

        weapons.forEach((weapon, index) => {
            const itemY = y + layout.titleGap + index * (layout.itemH + layout.itemGap);
            const isOwned = owned.includes(weapon.id);
            const isEquipped = equipped === weapon.id;
            const color = isEquipped ? 0x44ff88 : isOwned ? 0x67e8f9 : 0x334155;
            const button = new Container();
            button.addChild(this.drawButtonChrome(w, layout.itemH, color, isOwned ? 1 : 0.42));

            const label = isEquipped ? `${weapon.name.toUpperCase()}  EQUIPPED` : isOwned ? weapon.name.toUpperCase() : `${weapon.name.toUpperCase()}  LV ${weapon.unlockLevel}`;
            const nameText = new Text({ text: label, style: new TextStyle({ fill: isOwned ? 0x07110b : 0xcbd5e1, fontSize: layout.nameFont, fontWeight: 'bold', wordWrap: true, wordWrapWidth: w - 20 }) });
            nameText.position.set(10, layout.compact ? 4 : 7);
            button.addChild(nameText);

            const statText = new Text({
                text: title === 'MELEE'
                    ? `DMG ${weapon.damage}  RANGE ${weapon.range}`
                    : `DMG ${weapon.damage}  CD ${weapon.cooldown.toFixed(2)}  SPD ${weapon.projectileSpeed}`,
                style: new TextStyle({ fill: isOwned ? 0x172033 : 0x94a3b8, fontSize: layout.statFont, fontWeight: 'bold' }),
            });
            statText.position.set(10, layout.compact ? 21 : 26);
            button.addChild(statText);

            button.position.set(x, itemY);
            button.eventMode = isOwned ? 'static' : 'none';
            button.cursor = isOwned ? 'pointer' : 'default';
            this.registerButton(label, x, itemY, w, layout.itemH, isOwned);
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
        const upgradeY = y + layout.titleGap + weapons.length * (layout.itemH + layout.itemGap) + layout.upgradeGap;
        const canBuy = upgradeCost != null && this.gems >= upgradeCost;
        const button = new Container();
        button.addChild(this.drawButtonChrome(w, layout.upgradeH, canBuy ? 0xffd166 : 0x475569, canBuy ? 1 : 0.5));
        const upgradeText = new Text({
            text: upgradeLabel,
            style: new TextStyle({ fill: canBuy ? 0x07110b : 0xcbd5e1, fontSize: layout.compact ? 10 : 13, fontWeight: 'bold', wordWrap: true, wordWrapWidth: w - 24 }),
        });
        upgradeText.anchor.set(0.5);
        upgradeText.position.set(w / 2, layout.compact ? 13 : 16);
        button.addChild(upgradeText);
        const statText = new Text({
            text: slot === 'melee'
                ? `DMG x${upgrade.damageMultiplier}  RANGE BOOST`
                : `DMG x${upgrade.damageMultiplier}  FASTER SHOTS`,
            style: new TextStyle({ fill: canBuy ? 0x172033 : 0x94a3b8, fontSize: layout.compact ? 8 : 10, fontWeight: 'bold' }),
        });
        statText.anchor.set(0.5);
        statText.position.set(w / 2, layout.compact ? 27 : 34);
        button.addChild(statText);
        button.position.set(x, upgradeY);
        button.eventMode = upgradeCost == null ? 'none' : 'static';
        button.cursor = upgradeCost == null ? 'default' : 'pointer';
        this.registerButton(upgradeLabel, x, upgradeY, w, layout.upgradeH, upgradeCost != null);
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

    private addSettingLabel(x: number, y: number, label: string, fontSize: number = 18): void {
        const text = new Text({ text: label, style: new TextStyle({ fill: 0x91e5ff, fontSize, fontWeight: 'bold' }) });
        text.position.set(x, y);
        this.stage.addChild(text);
    }

    private addLevelButton(x: number, y: number, w: number, h: number, id: number, name: string, color: number): void {
        const button = new Container();
        button.addChild(this.drawButtonChrome(w, h, color));

        const compact = h < 66;
        const levelText = new Text({ text: `${id}`, style: new TextStyle({ fill: 0x07110b, fontSize: compact ? 20 : 26, fontWeight: 'bold' }) });
        levelText.position.set(12, compact ? 7 : 9);
        button.addChild(levelText);

        const nameText = new Text({ text: name.toUpperCase(), style: new TextStyle({ fill: 0x07110b, fontSize: compact ? 10 : 12, fontWeight: 'bold', wordWrap: true, wordWrapWidth: w - 20 }) });
        nameText.position.set(12, compact ? 34 : 43);
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

    private registerSurface(name: string, x: number, y: number, w: number, h: number): void {
        this.surfaceRegistry.push({
            name,
            mode: this.mode,
            x: Math.round(x),
            y: Math.round(y),
            w: Math.round(w),
            h: Math.round(h),
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

    private handleMessage = async (e: any) => {
        try {
            const rawData = e.data || e;
            const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            if (data.type === 'backButton') {
                if (this.mode === 'MAIN') {
                    // Flush pending writes (await mandatory — see flushPersistence comment)
                    // before signaling the host that it's safe to exit.
                    await this.flushPersistence();
                    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'safeToExit' }));
                } else {
                    this.drawMainMenu();
                }
                return;
            }
            if (data.type === 'debugStartLevel') {
                const requestedLevel = Number.isFinite(data.level) ? Math.floor(data.level) : this.unlockedLevel;
                this.engine.input.clearActions();
                GameScene.selectLevel(Math.max(1, Math.min(LEVELS.length, requestedLevel)));
                this.engine.scenes.loadScene(GameScene);
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
            surfaces: this.surfaceRegistry,
            visual: {
                main_menu_backdrop: 'generated-main-menu',
            },
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
