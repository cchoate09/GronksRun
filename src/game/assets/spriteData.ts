import openAiHero from '../../../assets/spritesheets/openai/hero-arcade.png';
import openAiEnemiesCore from '../../../assets/spritesheets/openai/enemies-core.png';
import openAiEnemiesExtra from '../../../assets/spritesheets/openai/enemies-extra.png';
import openAiObstacles from '../../../assets/spritesheets/openai/obstacles.png';
import biomePanorama from '../../../assets/backgrounds/biome-panorama.png';
import { Assets } from 'pixi.js';

export type SpriteState = 'IDLE' | 'RUN' | 'ATTACK' | 'RANGED_ATTACK' | 'HIT';

export interface SpriteSheetDefinition {
    image: string;
    cols: number;
    rows: number;
    width: number;
    height: number;
    fps: number;
    scale: number;
    facesRight?: boolean;
    anchorX?: number;
    anchorY?: number;
    spriteOffsetX?: number;
    spriteOffsetY?: number;
    animations: Partial<Record<SpriteState, number[]>> & Record<'IDLE' | 'RUN' | 'ATTACK' | 'HIT', number[]>;
}

export const HERO_SHEETS: Record<string, SpriteSheetDefinition> = {
    gronk: {
        image: openAiHero,
        cols: 4,
        rows: 4,
        width: 1024,
        height: 1024,
        fps: 9,
        scale: 0.34,
        facesRight: true,
        spriteOffsetY: 84,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [4, 5, 6, 7],
            ATTACK: [8, 9, 10, 11],
            RANGED_ATTACK: [10, 11, 9, 8],
            HIT: [12, 13, 14, 15],
        },
    },
    pip: {
        image: openAiHero,
        cols: 4,
        rows: 4,
        width: 1024,
        height: 1024,
        fps: 10,
        scale: 0.32,
        facesRight: true,
        spriteOffsetY: 84,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [4, 5, 6, 7],
            ATTACK: [8, 9, 10, 11],
            RANGED_ATTACK: [10, 11, 9, 8],
            HIT: [12, 13, 14, 15],
        },
    },
    rex: {
        image: openAiHero,
        cols: 4,
        rows: 4,
        width: 1024,
        height: 1024,
        fps: 8,
        scale: 0.36,
        facesRight: true,
        spriteOffsetY: 84,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [4, 5, 6, 7],
            ATTACK: [8, 9, 10, 11],
            RANGED_ATTACK: [10, 11, 9, 8],
            HIT: [12, 13, 14, 15],
        },
    },
};

export const ENEMY_SHEETS: Record<string, SpriteSheetDefinition> = {
    CHASER: {
        image: openAiEnemiesCore,
        cols: 4,
        rows: 4,
        width: 1536,
        height: 1024,
        fps: 8,
        scale: 0.32,
        facesRight: false,
        spriteOffsetY: 61,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [0, 1, 2, 3],
            ATTACK: [1, 2, 3],
            HIT: [3],
        },
    },
    RANGED: {
        image: openAiEnemiesCore,
        cols: 4,
        rows: 4,
        width: 1536,
        height: 1024,
        fps: 5,
        scale: 0.32,
        facesRight: false,
        spriteOffsetY: 61,
        animations: {
            IDLE: [4, 5, 6, 7],
            RUN: [4, 5, 6, 7],
            ATTACK: [5, 6, 7],
            HIT: [7],
        },
    },
    HEAVY: {
        image: openAiEnemiesCore,
        cols: 4,
        rows: 4,
        width: 1536,
        height: 1024,
        fps: 4,
        scale: 0.44,
        facesRight: false,
        spriteOffsetY: 92,
        animations: {
            IDLE: [8, 9, 10, 11],
            RUN: [8, 9, 10, 11],
            ATTACK: [9, 10, 11],
            HIT: [11],
        },
    },
    SERPENT: {
        image: openAiEnemiesCore,
        cols: 4,
        rows: 4,
        width: 1536,
        height: 1024,
        fps: 6,
        scale: 0.34,
        facesRight: false,
        spriteOffsetY: 56,
        animations: {
            IDLE: [12, 13, 14, 15],
            RUN: [12, 13, 14, 15],
            ATTACK: [13, 14, 15],
            HIT: [15],
        },
    },
    BOMBER: {
        image: openAiEnemiesExtra,
        cols: 4,
        rows: 4,
        width: 1536,
        height: 1024,
        fps: 6,
        scale: 0.34,
        facesRight: false,
        spriteOffsetY: 64,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [0, 1, 2, 3],
            ATTACK: [0, 1, 3],
            HIT: [2],
        },
    },
    DIVER: {
        image: openAiEnemiesExtra,
        cols: 4,
        rows: 4,
        width: 1536,
        height: 1024,
        fps: 8,
        scale: 0.31,
        facesRight: false,
        spriteOffsetY: 47,
        animations: {
            IDLE: [4, 5],
            RUN: [4, 5, 6, 7],
            ATTACK: [6, 7],
            HIT: [5],
        },
    },
    PTERO: {
        image: openAiEnemiesExtra,
        cols: 4,
        rows: 4,
        width: 1536,
        height: 1024,
        fps: 8,
        scale: 0.3,
        facesRight: false,
        spriteOffsetY: 47,
        animations: {
            IDLE: [8, 9],
            RUN: [8, 9, 10, 11],
            ATTACK: [10, 11],
            HIT: [9],
        },
    },
    GUARDIAN: {
        image: openAiEnemiesExtra,
        cols: 4,
        rows: 4,
        width: 1536,
        height: 1024,
        fps: 5,
        scale: 0.36,
        facesRight: false,
        spriteOffsetY: 74,
        animations: {
            IDLE: [12, 13],
            RUN: [12, 13, 14, 15],
            ATTACK: [13, 14, 15],
            HIT: [12],
        },
    },
};

export const OBSTACLE_SHEET: SpriteSheetDefinition = {
    image: openAiObstacles,
    cols: 4,
    rows: 3,
    width: 1536,
    height: 768,
    fps: 6,
    scale: 1,
    animations: {
        IDLE: [0, 1, 2, 3],
        RUN: [4, 5, 6, 7],
        ATTACK: [8, 9, 10, 11],
        HIT: [8],
    },
};

export async function preloadSpriteSheets(): Promise<void> {
    const urls = Array.from(new Set([
        ...Object.values(HERO_SHEETS).map((sheet) => sheet.image),
        ...Object.values(ENEMY_SHEETS).map((sheet) => sheet.image),
        OBSTACLE_SHEET.image,
        biomePanorama,
    ]));
    await Promise.all(urls.map((url) => Assets.load(url)));
}
