// A robust fixed-timestep AABB physics engine

export interface AABB {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface GroundGap {
    x: number;
    w: number;
}

export class Body implements AABB {
    public x: number = 0;
    public y: number = 0;
    public w: number = 0;
    public h: number = 0;

    public vx: number = 0;
    public vy: number = 0;
    public previousBottom: number = 0;

    public isStatic: boolean = false;
    public onGround: boolean = false;

    // Tuning parameters
    public gravityScale: number = 1.0;
    public friction: number = 0.8;
}

export class PhysicsEngine {
    private bodies: Body[] = [];
    private platforms: AABB[] = [];
    private groundGaps: GroundGap[] = [];
    private gravity: number = 2000; // Strong base gravity for snappy jumping
    private groundY: number = 600;

    public addBody(body: Body): void {
        this.bodies.push(body);
    }

    public removeBody(body: Body): void {
        const index = this.bodies.indexOf(body);
        if (index > -1) {
            this.bodies.splice(index, 1);
        }
    }

    public setGroundY(y: number): void {
        this.groundY = y;
    }

    public addPlatform(platform: AABB): void {
        this.platforms.push(platform);
    }

    public clearPlatforms(): void {
        this.platforms = [];
    }

    public setGroundGaps(gaps: GroundGap[]): void {
        this.groundGaps = gaps.map((gap) => ({
            x: gap.x,
            w: Math.max(0, gap.w),
        }));
    }

    public clearGroundGaps(): void {
        this.groundGaps = [];
    }

    public step(dt: number): void {
        // Integrate forces
        for (const body of this.bodies) {
            if (body.isStatic) continue;

            // Apply gravity
            body.vy += this.gravity * body.gravityScale * dt;

            // Apply terminal velocity
            if (body.vy > 1200) body.vy = 1200;

            body.previousBottom = body.y + body.h;

            // Integrate velocity
            body.x += body.vx * dt;
            body.y += body.vy * dt;

            // Apply friction (simple horizontal damping if on ground)
            if (body.onGround) {
                body.vx *= Math.pow(body.friction, dt * 60);
            }
        }

        this.resolveCollisions();
    }

    private resolveCollisions(): void {
        for (const body of this.bodies) {
            if (body.isStatic) continue;

            body.onGround = false;

            for (const platform of this.platforms) {
                const nextBottom = body.y + body.h;
                const overlapsX = body.x + body.w > platform.x && body.x < platform.x + platform.w;
                const fallingOntoTop = body.vy >= 0 && body.previousBottom <= platform.y + 8 && nextBottom >= platform.y;
                if (overlapsX && fallingOntoTop) {
                    body.y = platform.y - body.h;
                    body.vy = 0;
                    body.onGround = true;
                    break;
                }
            }

            if (body.y + body.h >= this.groundY && !this.isOverGroundGap(body)) {
                body.y = this.groundY - body.h;
                body.vy = 0;
                body.onGround = true;
            }
        }
    }

    private isOverGroundGap(body: Body): boolean {
        if (!this.groundGaps.length) return false;
        const footCenterX = body.x + body.w * 0.5;
        return this.groundGaps.some((gap) => footCenterX > gap.x && footCenterX < gap.x + gap.w);
    }
}
