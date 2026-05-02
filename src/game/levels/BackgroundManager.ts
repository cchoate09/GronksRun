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
        const colors = [0x1a1a24, 0x242435, 0x34344a]; // Dark to light
        const parallaxScales = [0.1, 0.3, 0.6];

        for (let i = 0; i < 3; i++) {
            const layer = new Container();
            const g = new Graphics();
            
            // Draw abstract distant structures
            const color = colors[i];
            for (let j = 0; j < 15; j++) {
                const w = 100 + Math.random() * 200;
                const h = 200 + Math.random() * 400;
                const x = Math.random() * this.width * 2;
                g.rect(x, this.height - h, w, h).fill(color);
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
