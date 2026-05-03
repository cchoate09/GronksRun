import { Body } from '../../engine/physics';
import { Graphics, Container } from 'pixi.js';

export class ParticleSystem extends Container {
    private particles: { view: Graphics, vx: number, vy: number, life: number, maxLife: number }[] = [];

    public spawn(x: number, y: number, color: number, count: number = 5): void {
        for (let i = 0; i < count; i++) {
            const g = new Graphics();
            const size = 2 + Math.random() * 4;
            g.rect(0, 0, size, size).fill(color);
            g.position.set(x, y);
            
            this.particles.push({
                view: g,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200 - 100,
                life: 1.0,
                maxLife: 1.0 + Math.random() * 0.5
            });
            this.addChild(g);
        }
    }

    public update(dt: number): void {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            
            if (p.life <= 0) {
                this.removeChild(p.view);
                p.view.destroy();
                this.particles.splice(i, 1);
                continue;
            }

            p.view.x += p.vx * dt;
            p.view.y += p.vy * dt;
            p.vy += 500 * dt; // Gravity
            p.view.alpha = p.life / p.maxLife;
        }
    }
}
