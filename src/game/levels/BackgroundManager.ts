import { Container, Graphics } from 'pixi.js';

export class BackgroundManager {
    private layers: Container[] = [];
    private view: Container;
    private width: number;
    private height: number;

    constructor(view: Container, width: number, height: number) {
        this.view = view;
        this.width = width;
        this.height = height;
        this.initLayers();
    }

    private initLayers(): void {
        const colors = [0x0a0a12, 0x1a1a2e, 0x2e2e4a]; // Deep space/city colors
        const parallaxScales = [0.05, 0.15, 0.4];

        for (let i = 0; i < 3; i++) {
            const layer = new Container();
            const g = new Graphics();
            
            const color = colors[i];
            const layerWidth = this.width * 3; // Wider for scrolling
            
            for (let j = 0; j < 25; j++) {
                const w = 80 + Math.random() * 150;
                const h = 150 + Math.random() * 500;
                const x = Math.random() * layerWidth;
                
                // Draw building
                g.rect(x, this.height - h, w, h).fill(color);
                
                // Draw some 'windows' for detail if it's the closest layer
                if (i === 2) {
                    const winColor = 0x555577;
                    for (let wy = this.height - h + 20; wy < this.height - 40; wy += 40) {
                        for (let wx = x + 15; wx < x + w - 15; wx += 30) {
                            if (Math.random() > 0.3) {
                                g.rect(wx, wy, 10, 15).fill(winColor);
                            }
                        }
                    }
                }
            }
            
            layer.addChild(g);
            (layer as any).parallaxScale = parallaxScales[i];
            this.layers.push(layer);
            this.view.addChildAt(layer, 0);
        }
    }

    public update(dt: number, cameraX: number): void {
        this.layers.forEach(layer => {
            const scale = (layer as any).parallaxScale;
            layer.x = -cameraX * scale;
        });
    }
}
