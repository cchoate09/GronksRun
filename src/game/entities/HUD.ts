import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export class HUD extends Container {
    private hpBar: Graphics;
    private hpFill: Graphics;
    private gemText: Text;
    private levelText: Text;
    private objectiveText: Text;
    
    private maxHp: number = 100;
    private currentHp: number = 100;
    private gems: number = 0;

    constructor() {
        super();

        this.hpBar = new Graphics();
        // HP Bar Container
        const hpBarContainer = new Container();
        hpBarContainer.position.set(20, 20);

        const hpBg = new Graphics();
        hpBg.rect(0, 0, 200, 20).fill(0x333333);
        hpBarContainer.addChild(hpBg);

        this.hpFill = new Graphics();
        this.updateHpBar();
        hpBarContainer.addChild(this.hpFill);

        const hpLabel = new Text({ 
            text: 'HP', 
            style: new TextStyle({ fill: 0xffffff, fontSize: 14, fontWeight: 'bold' }) 
        });
        hpLabel.position.set(5, -18);
        hpBarContainer.addChild(hpLabel);

        this.addChild(hpBarContainer);

        // Gem Counter
        this.gemText = new Text({ 
            text: 'GEMS: 0', 
            style: new TextStyle({ fill: 0xffd700, fontSize: 24, fontWeight: 'bold' }) 
        });
        this.gemText.position.set(20, 50);
        this.addChild(this.gemText);

        this.levelText = new Text({ 
            text: 'LEVEL 1', 
            style: new TextStyle({ fill: 0xffffff, fontSize: 24, fontWeight: 'bold' }) 
        });
        this.levelText.position.set(window.innerWidth - 150, 20);
        this.addChild(this.levelText);

        this.objectiveText = new Text({
            text: 'KILLS 0/3',
            style: new TextStyle({ fill: 0x91e5ff, fontSize: 18, fontWeight: 'bold' }),
        });
        this.objectiveText.position.set(window.innerWidth - 150, 52);
        this.addChild(this.objectiveText);
    }

    public updateStats(hp: number, maxHp: number, gems: number, level: number, kills: number = 0, targetKills: number = 0): void {
        this.currentHp = hp;
        this.maxHp = maxHp;
        this.gems = gems;
        
        this.updateHpBar();
        this.gemText.text = `GEMS: ${this.gems}`;
        this.levelText.text = `LEVEL ${level}`;
        this.objectiveText.text = targetKills > 0 ? `KILLS ${kills}/${targetKills}` : '';
        this.levelText.position.set(window.innerWidth - 150, 20);
        this.objectiveText.position.set(window.innerWidth - 150, 52);
    }

    private updateHpBar(): void {
        const pct = Math.max(0, this.currentHp / this.maxHp);
        this.hpFill.clear();
        this.hpFill.rect(2, 2, 196 * pct, 16).fill(pct > 0.3 ? 0x44ff88 : 0xff4444);
    }
}
