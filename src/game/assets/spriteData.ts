import gronk from '../../../assets/spritesheets/normalized/gronk.png';
import pip from '../../../assets/spritesheets/normalized/pip.png';
import rex from '../../../assets/spritesheets/normalized/rex.png';
import charger from '../../../assets/spritesheets/enemies/generated/charger.png';
import witch from '../../../assets/spritesheets/enemies/generated/witch.png';
import golem from '../../../assets/spritesheets/enemies/generated/golem.png';
import serpent from '../../../assets/spritesheets/enemies/generated/serpent.png';
import { Assets } from 'pixi.js';

export type SpriteState = 'IDLE' | 'RUN' | 'ATTACK' | 'HIT';

export interface SpriteSheetDefinition {
    image: string;
    cols: number;
    rows: number;
    width: number;
    height: number;
    fps: number;
    scale: number;
    animations: Record<SpriteState, number[]>;
}

export const HERO_SHEETS: Record<string, SpriteSheetDefinition> = {
    gronk: {
        image: gronk,
        cols: 8,
        rows: 3,
        width: 1024,
        height: 384,
        fps: 10,
        scale: 0.98,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [8, 9, 10, 11, 12, 13],
            ATTACK: [0, 1, 2, 3],
            HIT: [4],
        },
    },
    pip: {
        image: pip,
        cols: 8,
        rows: 3,
        width: 1024,
        height: 384,
        fps: 11,
        scale: 0.92,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [8, 9, 10, 11, 12, 13],
            ATTACK: [0, 1, 2, 3],
            HIT: [4],
        },
    },
    rex: {
        image: rex,
        cols: 8,
        rows: 3,
        width: 1024,
        height: 384,
        fps: 9,
        scale: 1.02,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [8, 9, 10, 11, 12, 13],
            ATTACK: [0, 1, 2, 3],
            HIT: [4],
        },
    },
};

export const ENEMY_SHEETS: Record<string, SpriteSheetDefinition> = {
    CHASER: {
        image: charger,
        cols: 4,
        rows: 2,
        width: 1024,
        height: 512,
        fps: 8,
        scale: 0.56,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [0, 1, 2, 3],
            ATTACK: [4, 5, 6],
            HIT: [7],
        },
    },
    RANGED: {
        image: witch,
        cols: 4,
        rows: 2,
        width: 1024,
        height: 512,
        fps: 5,
        scale: 0.56,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [0, 1, 2, 3],
            ATTACK: [4, 5, 6],
            HIT: [7],
        },
    },
    HEAVY: {
        image: golem,
        cols: 4,
        rows: 2,
        width: 1024,
        height: 512,
        fps: 4,
        scale: 0.72,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [0, 1, 2, 3],
            ATTACK: [4, 5, 6],
            HIT: [7],
        },
    },
    SERPENT: {
        image: serpent,
        cols: 4,
        rows: 2,
        width: 1024,
        height: 512,
        fps: 6,
        scale: 0.52,
        animations: {
            IDLE: [0, 1, 2, 3],
            RUN: [0, 1, 2, 3],
            ATTACK: [4, 5, 6],
            HIT: [7],
        },
    },
};

export async function preloadSpriteSheets(): Promise<void> {
    const urls = Array.from(new Set([
        ...Object.values(HERO_SHEETS).map((sheet) => sheet.image),
        ...Object.values(ENEMY_SHEETS).map((sheet) => sheet.image),
    ]));
    await Promise.all(urls.map((url) => Assets.load(url)));
}
