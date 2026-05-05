import { Graphics, Container } from 'pixi.js';

interface PooledParticle {
    view: Graphics;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    inUse: boolean;
}

// Hard cap on concurrent particles. Big fights spawn 80+ in a frame (multiple
// kills + melee + ranged + bombs); without a cap they're the dominant GC
// source on mobile WebView. Anything beyond this just doesn't spawn.
const MAX_PARTICLES = 140;

export class ParticleSystem extends Container {
    private particles: PooledParticle[] = [];
    private activeCount: number = 0;

    public spawn(x: number, y: number, color: number, count: number = 5): void {
        for (let i = 0; i < count; i++) {
            if (this.activeCount >= MAX_PARTICLES) return;
            const p = this.acquire();
            const size = 2 + Math.random() * 4;
            p.view.clear();
            p.view.rect(0, 0, size, size).fill(color);
            p.view.position.set(x, y);
            p.view.alpha = 1;
            p.vx = (Math.random() - 0.5) * 200;
            p.vy = (Math.random() - 0.5) * 200 - 100;
            p.life = 1.0;
            p.maxLife = 1.0 + Math.random() * 0.5;
            p.inUse = true;
            p.view.visible = true;
            this.activeCount++;
        }
    }

    private acquire(): PooledParticle {
        for (let i = 0; i < this.particles.length; i++) {
            const candidate = this.particles[i];
            if (!candidate.inUse) return candidate;
        }
        const view = new Graphics();
        this.addChild(view);
        const fresh: PooledParticle = { view, vx: 0, vy: 0, life: 0, maxLife: 1, inUse: false };
        this.particles.push(fresh);
        return fresh;
    }

    public update(dt: number): void {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.inUse) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.inUse = false;
                p.view.visible = false;
                this.activeCount--;
                continue;
            }
            p.view.x += p.vx * dt;
            p.view.y += p.vy * dt;
            p.vy += 500 * dt;
            p.view.alpha = p.life / p.maxLife;
        }
    }

    public clearAll(): void {
        for (const p of this.particles) {
            p.inUse = false;
            p.view.visible = false;
        }
        this.activeCount = 0;
    }
}
