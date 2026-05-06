import openAiHero from '../../../assets/spritesheets/openai/hero-arcade.png';
import openAiEnemiesCore from '../../../assets/spritesheets/openai/enemies-core.png';
import openAiEnemiesExtra from '../../../assets/spritesheets/openai/enemies-extra.png';
import openAiObstacles from '../../../assets/spritesheets/openai/obstacles.png';
import biomePanorama from '../../../assets/backgrounds/biome-panorama.png';
import mainMenuHero from '../../../assets/backgrounds/main-menu-hero.png';
import { Assets } from 'pixi.js';

export type SpriteState = 'IDLE' | 'RUN' | 'ATTACK' | 'RANGED_ATTACK' | 'JUMP' | 'FALL' | 'HIT';

export interface FrameOffset {
    x: number;
    y: number;
}

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
    frameOffsets?: Partial<Record<number, FrameOffset>>;
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
        frameOffsets: {
            0: { x: -0.5, y: 0 },
            1: { x: 0.25, y: 0 },
            2: { x: 0, y: 0 },
            3: { x: 0.25, y: 0 },
            4: { x: -5, y: 5.5 },
            5: { x: -2.5, y: 4.5 },
            6: { x: -1.75, y: 4.5 },
            7: { x: 0, y: 4.5 },
            8: { x: 1.75, y: 7.5 },
            9: { x: -4, y: 7.75 },
            10: { x: -9, y: 7.75 },
            11: { x: 2.25, y: 6 },
            12: { x: -5.5, y: 8.75 },
            13: { x: 0, y: 10.25 },
            14: { x: 2.5, y: 9.75 },
            15: { x: 1.5, y: 9.75 },
        },
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [4, 5, 6, 7],
            ATTACK: [8, 9, 10, 11],
            RANGED_ATTACK: [10, 11, 9, 8],
            JUMP: [12, 13],
            FALL: [14, 15],
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
        frameOffsets: {
            0: { x: -0.5, y: 0 },
            1: { x: 0.25, y: 0 },
            2: { x: 0, y: 0 },
            3: { x: 0.25, y: 0 },
            4: { x: -4.75, y: 5 },
            5: { x: -2.25, y: 4.25 },
            6: { x: -1.5, y: 4.25 },
            7: { x: 0, y: 4.25 },
            8: { x: 1.75, y: 7 },
            9: { x: -3.75, y: 7.25 },
            10: { x: -8.5, y: 7.25 },
            11: { x: 2, y: 5.75 },
            12: { x: -5, y: 8.25 },
            13: { x: 0, y: 9.5 },
            14: { x: 2.25, y: 9.25 },
            15: { x: 1.5, y: 9.25 },
        },
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [4, 5, 6, 7],
            ATTACK: [8, 9, 10, 11],
            RANGED_ATTACK: [10, 11, 9, 8],
            JUMP: [12, 13],
            FALL: [14, 15],
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
        frameOffsets: {
            0: { x: -0.5, y: 0 },
            1: { x: 0.25, y: 0 },
            2: { x: 0, y: 0 },
            3: { x: 0.25, y: 0 },
            4: { x: -5.25, y: 5.75 },
            5: { x: -2.5, y: 4.75 },
            6: { x: -1.75, y: 4.75 },
            7: { x: 0, y: 4.75 },
            8: { x: 2, y: 8 },
            9: { x: -4.25, y: 8.25 },
            10: { x: -9.5, y: 8.25 },
            11: { x: 2.25, y: 6.5 },
            12: { x: -5.75, y: 9.25 },
            13: { x: 0, y: 10.75 },
            14: { x: 2.5, y: 10.5 },
            15: { x: 1.5, y: 10.5 },
        },
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [4, 5, 6, 7],
            ATTACK: [8, 9, 10, 11],
            RANGED_ATTACK: [10, 11, 9, 8],
            JUMP: [12, 13],
            FALL: [14, 15],
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
        frameOffsets: {
            0: { x: -7.75, y: 0 },
            1: { x: 1, y: 0 },
            2: { x: -1, y: 0 },
            3: { x: 15.25, y: 3.25 },
        },
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
        frameOffsets: {
            4: { x: -13.5, y: 1.5 },
            5: { x: -1.5, y: 1.25 },
            6: { x: 3.25, y: 1 },
            7: { x: 1.5, y: 0 },
        },
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
        frameOffsets: {
            8: { x: 0, y: 0 },
            9: { x: 0, y: 0 },
            10: { x: 0.25, y: 0 },
            11: { x: 0, y: 0 },
        },
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
        frameOffsets: {
            12: { x: 0, y: 0 },
            13: { x: 0, y: 19.5 },
            14: { x: 0, y: 20.5 },
            15: { x: 14, y: 22.5 },
        },
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
        frameOffsets: {
            0: { x: -13.5, y: 0 },
            1: { x: -8.75, y: 0.25 },
            2: { x: 9.75, y: 0.25 },
            3: { x: 8.75, y: 0 },
        },
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
        frameOffsets: {
            4: { x: -12.75, y: 1.75 },
            5: { x: 0.25, y: 1.75 },
            6: { x: -0.25, y: 4 },
            7: { x: 8.75, y: 0 },
        },
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
        frameOffsets: {
            8: { x: -9.5, y: 0 },
            9: { x: 3.25, y: 0 },
            10: { x: -3.25, y: 0 },
            11: { x: 7.75, y: 0 },
        },
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
        frameOffsets: {
            12: { x: 2, y: 0 },
            13: { x: -2, y: 18.25 },
            14: { x: -2, y: 20.5 },
            15: { x: 2, y: 20.5 },
        },
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
        mainMenuHero,
    ]));
    await Promise.all(urls.map((url) => Assets.load(url)));
}
