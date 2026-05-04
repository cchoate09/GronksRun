import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import biomePanorama from '../../../assets/backgrounds/biome-panorama.png';

export class BackgroundManager {
    private layers: Container[] = [];
    private view: Container;
    private width: number;
    private height: number;
    private biome: string;

    constructor(view: Container, width: number, height: number, biome: string = 'Ruined Coast') {
        this.view = view;
        this.width = width;
        this.height = height;
        this.biome = biome;
        this.initLayers();
    }

    private initLayers(): void {
        const palette = this.getBiomePalette(this.biome);
        const colors = palette.layers;
        const artLayer = new Container();
        const baseTexture = Texture.from(biomePanorama);
        const biomeIndex = this.getBiomeIndex(this.biome);
        const panelCount = 6;
        const sourceWidth = baseTexture.width || this.width;
        const sourceHeight = baseTexture.height || this.height;
        const sourcePanelWidth = sourceWidth / panelCount;
        const panelTexture = new Texture({
            source: baseTexture.source,
            frame: new Rectangle(
                Math.min(panelCount - 1, biomeIndex) * sourcePanelWidth,
                0,
                sourcePanelWidth,
                sourceHeight,
            ),
        });
        const art = new Sprite(panelTexture);
        const panelWidth = Math.max(1, window.innerWidth || this.width);
        art.width = panelWidth;
        art.height = this.height;
        art.x = 0;
        art.y = 0;
        art.alpha = 0.55;
        artLayer.addChild(art);
        (artLayer as any).baseX = 0;
        (artLayer as any).screenParallax = true;
        (artLayer as any).parallaxScale = 0.02;
        this.layers.push(artLayer);
        this.view.addChildAt(artLayer, 0);

        const parallaxScales = [0.06, 0.16, 0.34];

        for (let i = 0; i < 3; i++) {
            const layer = new Container();
            const g = new Graphics();
            
            const color = colors[i];
            const layerWidth = this.width * 3; // Wider for scrolling
            layer.alpha = i === 2 ? 0.42 : 0.3;
            
            for (let j = 0; j < 25; j++) {
                const w = 80 + Math.random() * 150;
                const h = palette.shape === 'blocks' ? 90 + Math.random() * 260 : 150 + Math.random() * 500;
                const x = Math.random() * layerWidth;
                
                if (palette.shape === 'canopy') {
                    g.rect(x + w * 0.45, this.height - h * 0.62, Math.max(12, w * 0.12), h * 0.62).fill(color);
                    g.circle(x + w * 0.5, this.height - h * 0.72, Math.max(42, w * 0.42)).fill(color);
                } else if (palette.shape === 'spires') {
                    g.moveTo(x, this.height).lineTo(x + w * 0.5, this.height - h).lineTo(x + w, this.height).closePath().fill(color);
                } else if (palette.shape === 'clouds') {
                    g.ellipse(x + w * 0.5, this.height - h * 0.34, w * 0.52, h * 0.16).fill(color);
                    g.circle(x + w * 0.24, this.height - h * 0.38, w * 0.22).fill(color);
                    g.circle(x + w * 0.62, this.height - h * 0.42, w * 0.28).fill(color);
                } else {
                    g.rect(x, this.height - h, w, h).fill(color);
                }
                
                const shouldDrawWindows = i === 2 && (this.biome.includes('Moonlit') || this.biome.includes('Glass'));
                if (shouldDrawWindows) {
                    const winColor = palette.detail;
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
            this.view.addChildAt(layer, Math.min(i + 1, this.view.children.length));
        }
    }

    private getBiomeIndex(biome: string): number {
        if (biome.includes('Moonlit')) return 1;
        if (biome.includes('Temple')) return 2;
        if (biome.includes('Ash')) return 3;
        if (biome.includes('Glass')) return 4;
        if (biome.includes('Sky')) return 5;
        return 0;
    }

    private getBiomePalette(biome: string): { layers: number[]; detail: number; shape: 'blocks' | 'canopy' | 'spires' | 'clouds' } {
        if (biome.includes('Temple')) {
            return { layers: [0x07150f, 0x123521, 0x24563b], detail: 0xffd166, shape: 'canopy' };
        }
        if (biome.includes('Ash')) {
            return { layers: [0x160c0c, 0x3a1b18, 0x6b2d1f], detail: 0xff8844, shape: 'spires' };
        }
        if (biome.includes('Glass')) {
            return { layers: [0x07131f, 0x12324b, 0x1f6f8d], detail: 0x91e5ff, shape: 'spires' };
        }
        if (biome.includes('Sky')) {
            return { layers: [0x0b1730, 0x1e4f75, 0x4ba6c8], detail: 0xffffff, shape: 'clouds' };
        }
        if (biome.includes('Moonlit')) {
            return { layers: [0x09071a, 0x1c1745, 0x3b3476], detail: 0xc4b5fd, shape: 'blocks' };
        }
        return { layers: [0x07141c, 0x123041, 0x245b68], detail: 0x67e8f9, shape: 'blocks' };
    }

    public update(dt: number, cameraX: number): void {
        this.layers.forEach(layer => {
            const scale = (layer as any).parallaxScale;
            if ((layer as any).screenParallax) {
                layer.x = ((layer as any).baseX || 0) + cameraX * (1 - scale);
            } else {
                layer.x = -cameraX * scale;
            }
        });
    }
}
