import { Scene } from '../../engine/scenes/SceneManager';
import { GameEngine } from '../../engine/GameEngine';
import { Container, Graphics, Text, TextStyle, Sprite, Texture, Rectangle } from 'pixi.js';
import { Player } from '../entities/Player';
import { Enemy, RangedEnemy, HeavyEnemy, SerpentEnemy, Projectile, EnemyTargetSnapshot, BomberEnemy, DiverEnemy, PteroEnemy, GuardianEnemy } from '../entities/Enemy';
import { BackgroundManager } from '../levels/BackgroundManager';
import { HUD } from '../entities/HUD';
import { ParticleSystem } from '../entities/ParticleSystem';
import { MenuScene } from './MenuScene';
import { readNumber, writeNumber } from '../storage';
import { SoundManager } from '../audio/SoundManager';
import { OBSTACLE_SHEET } from '../assets/spriteData';
import { getEffectiveWeapon, getWeaponUpgradeSnapshot, grantWeaponsForLevel, WeaponDefinition } from '../weapons';

export type EnemyKind = 'CHASER' | 'RANGED' | 'HEAVY' | 'SERPENT' | 'BOMBER' | 'DIVER' | 'PTERO' | 'GUARDIAN';
export type TerrainProfile = 'shore-sprint' | 'broken-steps' | 'witchline-crossfire' | 'serpent-lanes' | 'stone-guard' | 'crossfire-ridge' | 'golem-bridge' | 'night-ambush' | 'iron-rush' | 'sky-gauntlet';
export type RouteStyle = 'flat-pressure' | 'broken-climb' | 'crossfire-steps' | 'low-serpent' | 'guard-bridges' | 'hazard-ridge' | 'heavy-bridge' | 'ambush-switchbacks' | 'rush-lanes' | 'sky-chains';

export interface LevelModifiers {
    routeStyle: RouteStyle;
    hazardDensity: number;
    verticality: number;
    pressureBias: 'steady' | 'ranged' | 'serpent' | 'heavy' | 'mixed';
}

export interface LevelDefinition {
    id: number;
    name: string;
    biome: string;
    targetKills: number;
    maxActive: number;
    enemyKinds: EnemyKind[];
    spawnGap: number;
    runUpDistance: number;
    encounterSpacing: number;
    levelLength: number;
    reward: number;
    terrainProfile: TerrainProfile;
    spawnPattern: EnemyKind[];
    levelModifiers: LevelModifiers;
}

interface TerrainPlatform {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface TerrainGap {
    x: number;
    w: number;
    depth: number;
}

type EnemyGapAction = 'none' | 'gap-vault' | 'gap-retreat' | 'gap-recover';

interface EnemyGapManeuver {
    action: EnemyGapAction;
    timer: number;
    dir: number;
    gapX: number;
    gapW: number;
}

interface Hazard {
    type: 'spikes' | 'fireVent' | 'spellRune';
    x: number;
    y: number;
    w: number;
    h: number;
    damage: number;
    active: boolean;
    phase: number;
}

interface BombExplosion {
    x: number;
    y: number;
    radius: number;
    life: number;
    maxLife: number;
    view: Graphics;
}

interface OverlayButtonSnapshot {
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

const OBSTACLE_FRAME_ANCHORS: Record<number, { x: number; y: number }> = {
    0: { x: 0.568, y: 0.855 },
    1: { x: 0.499, y: 0.855 },
    2: { x: 0.499, y: 0.996 },
    3: { x: 0.486, y: 0.996 },
    4: { x: 0.405, y: 0.832 },
    5: { x: 0.331, y: 0.832 },
    6: { x: 0.366, y: 0.996 },
    7: { x: 0.409, y: 0.996 },
    8: { x: 0.401, y: 0.859 },
    9: { x: 0.327, y: 0.859 },
    10: { x: 0.363, y: 0.859 },
    11: { x: 0.406, y: 0.859 },
};

export const LEVELS: LevelDefinition[] = [
    { id: 1, name: 'Blue Gate', biome: 'Ruined Coast', targetKills: 18, maxActive: 2, enemyKinds: ['CHASER'], spawnGap: 1.0, runUpDistance: 760, encounterSpacing: 680, levelLength: 26000, reward: 20, terrainProfile: 'shore-sprint', spawnPattern: ['CHASER', 'CHASER', 'CHASER'], levelModifiers: { routeStyle: 'flat-pressure', hazardDensity: 0.08, verticality: 0.15, pressureBias: 'steady' } },
    { id: 2, name: 'Broken Steps', biome: 'Ruined Coast', targetKills: 20, maxActive: 2, enemyKinds: ['CHASER'], spawnGap: 0.95, runUpDistance: 820, encounterSpacing: 650, levelLength: 30000, reward: 25, terrainProfile: 'broken-steps', spawnPattern: ['CHASER', 'CHASER', 'CHASER'], levelModifiers: { routeStyle: 'broken-climb', hazardDensity: 0.16, verticality: 0.34, pressureBias: 'steady' } },
    { id: 3, name: 'Witchline', biome: 'Moonlit Road', targetKills: 23, maxActive: 3, enemyKinds: ['CHASER', 'RANGED', 'BOMBER'], spawnGap: 0.9, runUpDistance: 880, encounterSpacing: 620, levelLength: 34000, reward: 30, terrainProfile: 'witchline-crossfire', spawnPattern: ['CHASER', 'RANGED', 'BOMBER', 'RANGED'], levelModifiers: { routeStyle: 'crossfire-steps', hazardDensity: 0.22, verticality: 0.42, pressureBias: 'ranged' } },
    { id: 4, name: 'Serpent Run', biome: 'Temple Jungle', targetKills: 26, maxActive: 3, enemyKinds: ['CHASER', 'SERPENT', 'DIVER'], spawnGap: 0.85, runUpDistance: 900, encounterSpacing: 600, levelLength: 39000, reward: 35, terrainProfile: 'serpent-lanes', spawnPattern: ['SERPENT', 'CHASER', 'DIVER', 'SERPENT'], levelModifiers: { routeStyle: 'low-serpent', hazardDensity: 0.28, verticality: 0.24, pressureBias: 'serpent' } },
    { id: 5, name: 'Stone Guard', biome: 'Temple Jungle', targetKills: 30, maxActive: 3, enemyKinds: ['CHASER', 'HEAVY', 'GUARDIAN'], spawnGap: 0.8, runUpDistance: 920, encounterSpacing: 580, levelLength: 44000, reward: 40, terrainProfile: 'stone-guard', spawnPattern: ['GUARDIAN', 'CHASER', 'HEAVY', 'GUARDIAN'], levelModifiers: { routeStyle: 'guard-bridges', hazardDensity: 0.2, verticality: 0.5, pressureBias: 'heavy' } },
    { id: 6, name: 'Crossfire', biome: 'Ash Ravine', targetKills: 34, maxActive: 4, enemyKinds: ['CHASER', 'RANGED', 'SERPENT', 'BOMBER'], spawnGap: 0.76, runUpDistance: 940, encounterSpacing: 560, levelLength: 50000, reward: 45, terrainProfile: 'crossfire-ridge', spawnPattern: ['RANGED', 'BOMBER', 'SERPENT', 'RANGED'], levelModifiers: { routeStyle: 'hazard-ridge', hazardDensity: 0.36, verticality: 0.46, pressureBias: 'ranged' } },
    { id: 7, name: 'Golem Bridge', biome: 'Ash Ravine', targetKills: 38, maxActive: 4, enemyKinds: ['CHASER', 'HEAVY', 'RANGED', 'PTERO'], spawnGap: 0.72, runUpDistance: 960, encounterSpacing: 540, levelLength: 56000, reward: 50, terrainProfile: 'golem-bridge', spawnPattern: ['HEAVY', 'PTERO', 'RANGED', 'CHASER'], levelModifiers: { routeStyle: 'heavy-bridge', hazardDensity: 0.3, verticality: 0.58, pressureBias: 'heavy' } },
    { id: 8, name: 'Night Ambush', biome: 'Glass City', targetKills: 42, maxActive: 4, enemyKinds: ['CHASER', 'SERPENT', 'RANGED', 'DIVER', 'BOMBER'], spawnGap: 0.68, runUpDistance: 980, encounterSpacing: 520, levelLength: 62000, reward: 60, terrainProfile: 'night-ambush', spawnPattern: ['DIVER', 'RANGED', 'BOMBER', 'SERPENT'], levelModifiers: { routeStyle: 'ambush-switchbacks', hazardDensity: 0.42, verticality: 0.54, pressureBias: 'mixed' } },
    { id: 9, name: 'Iron Rush', biome: 'Glass City', targetKills: 46, maxActive: 5, enemyKinds: ['CHASER', 'HEAVY', 'SERPENT', 'GUARDIAN', 'PTERO'], spawnGap: 0.64, runUpDistance: 1000, encounterSpacing: 500, levelLength: 69000, reward: 70, terrainProfile: 'iron-rush', spawnPattern: ['PTERO', 'GUARDIAN', 'SERPENT', 'CHASER', 'HEAVY'], levelModifiers: { routeStyle: 'rush-lanes', hazardDensity: 0.48, verticality: 0.38, pressureBias: 'mixed' } },
    { id: 10, name: 'Gronk Gauntlet', biome: 'Sky Forge', targetKills: 50, maxActive: 5, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'SERPENT', 'BOMBER', 'DIVER', 'PTERO', 'GUARDIAN'], spawnGap: 0.6, runUpDistance: 1040, encounterSpacing: 480, levelLength: 76000, reward: 100, terrainProfile: 'sky-gauntlet', spawnPattern: ['RANGED', 'PTERO', 'GUARDIAN', 'BOMBER', 'DIVER', 'HEAVY'], levelModifiers: { routeStyle: 'sky-chains', hazardDensity: 0.52, verticality: 0.72, pressureBias: 'mixed' } },
    { id: 11, name: 'Ember Causeway', biome: 'Ash Ravine', targetKills: 51, maxActive: 5, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'SERPENT'], spawnGap: 0.58, runUpDistance: 1040, encounterSpacing: 480, levelLength: 76100, reward: 110, terrainProfile: 'crossfire-ridge', spawnPattern: ['HEAVY', 'RANGED', 'SERPENT', 'CHASER'], levelModifiers: { routeStyle: 'hazard-ridge', hazardDensity: 0.44, verticality: 0.52, pressureBias: 'mixed' } },
    { id: 12, name: 'Wyrm Stairs', biome: 'Temple Jungle', targetKills: 52, maxActive: 5, enemyKinds: ['CHASER', 'SERPENT', 'DIVER', 'BOMBER'], spawnGap: 0.57, runUpDistance: 1045, encounterSpacing: 478, levelLength: 76180, reward: 115, terrainProfile: 'serpent-lanes', spawnPattern: ['SERPENT', 'DIVER', 'BOMBER', 'SERPENT', 'CHASER'], levelModifiers: { routeStyle: 'low-serpent', hazardDensity: 0.36, verticality: 0.5, pressureBias: 'serpent' } },
    { id: 13, name: 'Glass Switchback', biome: 'Glass City', targetKills: 53, maxActive: 5, enemyKinds: ['CHASER', 'RANGED', 'DIVER', 'PTERO'], spawnGap: 0.56, runUpDistance: 1050, encounterSpacing: 476, levelLength: 76260, reward: 120, terrainProfile: 'night-ambush', spawnPattern: ['DIVER', 'RANGED', 'PTERO', 'CHASER', 'RANGED'], levelModifiers: { routeStyle: 'ambush-switchbacks', hazardDensity: 0.43, verticality: 0.58, pressureBias: 'ranged' } },
    { id: 14, name: 'Moonlit Siege', biome: 'Moonlit Road', targetKills: 54, maxActive: 5, enemyKinds: ['CHASER', 'RANGED', 'GUARDIAN', 'BOMBER'], spawnGap: 0.55, runUpDistance: 1055, encounterSpacing: 474, levelLength: 76340, reward: 125, terrainProfile: 'witchline-crossfire', spawnPattern: ['GUARDIAN', 'RANGED', 'BOMBER', 'CHASER', 'RANGED'], levelModifiers: { routeStyle: 'crossfire-steps', hazardDensity: 0.4, verticality: 0.46, pressureBias: 'ranged' } },
    { id: 15, name: 'Sky Hooks', biome: 'Sky Forge', targetKills: 55, maxActive: 5, enemyKinds: ['CHASER', 'HEAVY', 'PTERO', 'GUARDIAN'], spawnGap: 0.54, runUpDistance: 1060, encounterSpacing: 472, levelLength: 76420, reward: 130, terrainProfile: 'sky-gauntlet', spawnPattern: ['PTERO', 'HEAVY', 'GUARDIAN', 'CHASER', 'PTERO'], levelModifiers: { routeStyle: 'sky-chains', hazardDensity: 0.5, verticality: 0.7, pressureBias: 'heavy' } },
    { id: 16, name: 'Tidebreaker', biome: 'Ruined Coast', targetKills: 56, maxActive: 5, enemyKinds: ['CHASER', 'SERPENT', 'RANGED', 'HEAVY'], spawnGap: 0.54, runUpDistance: 1065, encounterSpacing: 470, levelLength: 76500, reward: 135, terrainProfile: 'broken-steps', spawnPattern: ['CHASER', 'SERPENT', 'HEAVY', 'RANGED', 'SERPENT'], levelModifiers: { routeStyle: 'broken-climb', hazardDensity: 0.32, verticality: 0.48, pressureBias: 'mixed' } },
    { id: 17, name: 'Obsidian Lanes', biome: 'Ash Ravine', targetKills: 57, maxActive: 5, enemyKinds: ['CHASER', 'RANGED', 'BOMBER', 'DIVER', 'SERPENT'], spawnGap: 0.53, runUpDistance: 1070, encounterSpacing: 468, levelLength: 76580, reward: 140, terrainProfile: 'iron-rush', spawnPattern: ['BOMBER', 'DIVER', 'SERPENT', 'RANGED', 'CHASER'], levelModifiers: { routeStyle: 'rush-lanes', hazardDensity: 0.5, verticality: 0.44, pressureBias: 'mixed' } },
    { id: 18, name: 'Verdant Knives', biome: 'Temple Jungle', targetKills: 58, maxActive: 5, enemyKinds: ['CHASER', 'SERPENT', 'GUARDIAN', 'PTERO'], spawnGap: 0.52, runUpDistance: 1075, encounterSpacing: 466, levelLength: 76660, reward: 145, terrainProfile: 'stone-guard', spawnPattern: ['SERPENT', 'GUARDIAN', 'PTERO', 'SERPENT', 'CHASER'], levelModifiers: { routeStyle: 'guard-bridges', hazardDensity: 0.34, verticality: 0.6, pressureBias: 'serpent' } },
    { id: 19, name: 'Neon Breakers', biome: 'Glass City', targetKills: 59, maxActive: 5, enemyKinds: ['CHASER', 'RANGED', 'BOMBER', 'PTERO', 'GUARDIAN'], spawnGap: 0.51, runUpDistance: 1080, encounterSpacing: 464, levelLength: 76740, reward: 150, terrainProfile: 'night-ambush', spawnPattern: ['PTERO', 'RANGED', 'BOMBER', 'GUARDIAN', 'CHASER'], levelModifiers: { routeStyle: 'ambush-switchbacks', hazardDensity: 0.46, verticality: 0.56, pressureBias: 'ranged' } },
    { id: 20, name: 'Forge Crown', biome: 'Sky Forge', targetKills: 60, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'SERPENT', 'BOMBER', 'DIVER', 'PTERO', 'GUARDIAN'], spawnGap: 0.5, runUpDistance: 1085, encounterSpacing: 462, levelLength: 76820, reward: 160, terrainProfile: 'sky-gauntlet', spawnPattern: ['GUARDIAN', 'PTERO', 'BOMBER', 'HEAVY', 'DIVER', 'RANGED'], levelModifiers: { routeStyle: 'sky-chains', hazardDensity: 0.54, verticality: 0.72, pressureBias: 'mixed' } },
    { id: 21, name: 'Saltwind Trial', biome: 'Ruined Coast', targetKills: 61, maxActive: 6, enemyKinds: ['CHASER', 'HEAVY', 'SERPENT', 'BOMBER'], spawnGap: 0.5, runUpDistance: 1090, encounterSpacing: 460, levelLength: 76880, reward: 165, terrainProfile: 'shore-sprint', spawnPattern: ['HEAVY', 'SERPENT', 'BOMBER', 'CHASER', 'SERPENT'], levelModifiers: { routeStyle: 'flat-pressure', hazardDensity: 0.28, verticality: 0.3, pressureBias: 'heavy' } },
    { id: 22, name: 'Cinder Switch', biome: 'Ash Ravine', targetKills: 62, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'BOMBER', 'DIVER'], spawnGap: 0.49, runUpDistance: 1090, encounterSpacing: 459, levelLength: 76940, reward: 170, terrainProfile: 'crossfire-ridge', spawnPattern: ['RANGED', 'BOMBER', 'DIVER', 'RANGED', 'CHASER'], levelModifiers: { routeStyle: 'hazard-ridge', hazardDensity: 0.52, verticality: 0.52, pressureBias: 'ranged' } },
    { id: 23, name: 'Rootfall Vault', biome: 'Temple Jungle', targetKills: 63, maxActive: 6, enemyKinds: ['CHASER', 'SERPENT', 'HEAVY', 'PTERO'], spawnGap: 0.49, runUpDistance: 1090, encounterSpacing: 458, levelLength: 77000, reward: 175, terrainProfile: 'golem-bridge', spawnPattern: ['SERPENT', 'HEAVY', 'PTERO', 'CHASER', 'HEAVY'], levelModifiers: { routeStyle: 'heavy-bridge', hazardDensity: 0.38, verticality: 0.64, pressureBias: 'heavy' } },
    { id: 24, name: 'Blackglass Run', biome: 'Glass City', targetKills: 64, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'SERPENT', 'GUARDIAN', 'DIVER'], spawnGap: 0.48, runUpDistance: 1090, encounterSpacing: 457, levelLength: 77060, reward: 180, terrainProfile: 'iron-rush', spawnPattern: ['DIVER', 'GUARDIAN', 'SERPENT', 'RANGED', 'CHASER'], levelModifiers: { routeStyle: 'rush-lanes', hazardDensity: 0.5, verticality: 0.48, pressureBias: 'mixed' } },
    { id: 25, name: 'Starforge Rift', biome: 'Sky Forge', targetKills: 65, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'BOMBER', 'PTERO'], spawnGap: 0.48, runUpDistance: 1090, encounterSpacing: 456, levelLength: 77100, reward: 185, terrainProfile: 'sky-gauntlet', spawnPattern: ['PTERO', 'BOMBER', 'HEAVY', 'RANGED', 'PTERO'], levelModifiers: { routeStyle: 'sky-chains', hazardDensity: 0.56, verticality: 0.72, pressureBias: 'mixed' } },
    { id: 26, name: 'Moonfang Alley', biome: 'Moonlit Road', targetKills: 66, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'SERPENT', 'BOMBER', 'GUARDIAN'], spawnGap: 0.47, runUpDistance: 1095, encounterSpacing: 455, levelLength: 77140, reward: 190, terrainProfile: 'witchline-crossfire', spawnPattern: ['SERPENT', 'RANGED', 'GUARDIAN', 'BOMBER', 'RANGED'], levelModifiers: { routeStyle: 'crossfire-steps', hazardDensity: 0.48, verticality: 0.5, pressureBias: 'ranged' } },
    { id: 27, name: 'Golem Teeth', biome: 'Ash Ravine', targetKills: 67, maxActive: 6, enemyKinds: ['CHASER', 'HEAVY', 'GUARDIAN', 'DIVER', 'SERPENT'], spawnGap: 0.47, runUpDistance: 1095, encounterSpacing: 454, levelLength: 77180, reward: 195, terrainProfile: 'golem-bridge', spawnPattern: ['HEAVY', 'GUARDIAN', 'DIVER', 'SERPENT', 'HEAVY'], levelModifiers: { routeStyle: 'heavy-bridge', hazardDensity: 0.44, verticality: 0.62, pressureBias: 'heavy' } },
    { id: 28, name: 'Serpent Crown', biome: 'Temple Jungle', targetKills: 68, maxActive: 6, enemyKinds: ['CHASER', 'SERPENT', 'BOMBER', 'PTERO', 'RANGED'], spawnGap: 0.46, runUpDistance: 1095, encounterSpacing: 453, levelLength: 77220, reward: 200, terrainProfile: 'serpent-lanes', spawnPattern: ['SERPENT', 'PTERO', 'BOMBER', 'SERPENT', 'RANGED'], levelModifiers: { routeStyle: 'low-serpent', hazardDensity: 0.42, verticality: 0.54, pressureBias: 'serpent' } },
    { id: 29, name: 'Crystal Riot', biome: 'Glass City', targetKills: 69, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'DIVER', 'PTERO', 'GUARDIAN'], spawnGap: 0.46, runUpDistance: 1095, encounterSpacing: 452, levelLength: 77260, reward: 205, terrainProfile: 'night-ambush', spawnPattern: ['DIVER', 'PTERO', 'RANGED', 'GUARDIAN', 'HEAVY'], levelModifiers: { routeStyle: 'ambush-switchbacks', hazardDensity: 0.52, verticality: 0.6, pressureBias: 'mixed' } },
    { id: 30, name: 'Storm Anvil', biome: 'Sky Forge', targetKills: 70, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'SERPENT', 'BOMBER', 'DIVER', 'PTERO', 'GUARDIAN'], spawnGap: 0.45, runUpDistance: 1100, encounterSpacing: 451, levelLength: 77300, reward: 215, terrainProfile: 'sky-gauntlet', spawnPattern: ['PTERO', 'GUARDIAN', 'BOMBER', 'DIVER', 'HEAVY', 'SERPENT'], levelModifiers: { routeStyle: 'sky-chains', hazardDensity: 0.56, verticality: 0.72, pressureBias: 'mixed' } },
    { id: 31, name: 'Broken Crown', biome: 'Ruined Coast', targetKills: 70, maxActive: 6, enemyKinds: ['CHASER', 'HEAVY', 'SERPENT', 'GUARDIAN'], spawnGap: 0.45, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77320, reward: 220, terrainProfile: 'broken-steps', spawnPattern: ['GUARDIAN', 'HEAVY', 'SERPENT', 'CHASER', 'HEAVY'], levelModifiers: { routeStyle: 'broken-climb', hazardDensity: 0.4, verticality: 0.56, pressureBias: 'heavy' } },
    { id: 32, name: 'Ashen Chorus', biome: 'Ash Ravine', targetKills: 71, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'BOMBER', 'DIVER', 'PTERO'], spawnGap: 0.45, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77340, reward: 225, terrainProfile: 'crossfire-ridge', spawnPattern: ['RANGED', 'DIVER', 'BOMBER', 'PTERO', 'RANGED'], levelModifiers: { routeStyle: 'hazard-ridge', hazardDensity: 0.56, verticality: 0.58, pressureBias: 'ranged' } },
    { id: 33, name: 'Jungle Crucible', biome: 'Temple Jungle', targetKills: 71, maxActive: 6, enemyKinds: ['CHASER', 'SERPENT', 'HEAVY', 'BOMBER', 'GUARDIAN'], spawnGap: 0.44, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77360, reward: 230, terrainProfile: 'stone-guard', spawnPattern: ['SERPENT', 'GUARDIAN', 'BOMBER', 'HEAVY', 'SERPENT'], levelModifiers: { routeStyle: 'guard-bridges', hazardDensity: 0.46, verticality: 0.62, pressureBias: 'mixed' } },
    { id: 34, name: 'Glassfire Chase', biome: 'Glass City', targetKills: 72, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'SERPENT', 'DIVER', 'PTERO', 'GUARDIAN'], spawnGap: 0.44, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77400, reward: 235, terrainProfile: 'iron-rush', spawnPattern: ['PTERO', 'DIVER', 'SERPENT', 'GUARDIAN', 'RANGED'], levelModifiers: { routeStyle: 'rush-lanes', hazardDensity: 0.54, verticality: 0.52, pressureBias: 'mixed' } },
    { id: 35, name: 'High Forge War', biome: 'Sky Forge', targetKills: 72, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'SERPENT', 'BOMBER', 'DIVER', 'PTERO', 'GUARDIAN'], spawnGap: 0.44, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77400, reward: 240, terrainProfile: 'sky-gauntlet', spawnPattern: ['GUARDIAN', 'PTERO', 'HEAVY', 'BOMBER', 'DIVER', 'SERPENT'], levelModifiers: { routeStyle: 'sky-chains', hazardDensity: 0.56, verticality: 0.72, pressureBias: 'mixed' } },
    { id: 36, name: 'Coastbreaker Elite', biome: 'Ruined Coast', targetKills: 72, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'SERPENT', 'PTERO'], spawnGap: 0.44, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77400, reward: 245, terrainProfile: 'shore-sprint', spawnPattern: ['CHASER', 'PTERO', 'HEAVY', 'SERPENT', 'RANGED'], levelModifiers: { routeStyle: 'flat-pressure', hazardDensity: 0.34, verticality: 0.36, pressureBias: 'mixed' } },
    { id: 37, name: 'Witchstorm Apex', biome: 'Moonlit Road', targetKills: 72, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'BOMBER', 'DIVER', 'GUARDIAN'], spawnGap: 0.44, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77400, reward: 250, terrainProfile: 'witchline-crossfire', spawnPattern: ['RANGED', 'GUARDIAN', 'BOMBER', 'DIVER', 'RANGED'], levelModifiers: { routeStyle: 'crossfire-steps', hazardDensity: 0.52, verticality: 0.54, pressureBias: 'ranged' } },
    { id: 38, name: 'Obsidian Apex', biome: 'Ash Ravine', targetKills: 72, maxActive: 6, enemyKinds: ['CHASER', 'HEAVY', 'SERPENT', 'BOMBER', 'PTERO', 'GUARDIAN'], spawnGap: 0.44, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77400, reward: 260, terrainProfile: 'golem-bridge', spawnPattern: ['HEAVY', 'PTERO', 'GUARDIAN', 'SERPENT', 'BOMBER'], levelModifiers: { routeStyle: 'heavy-bridge', hazardDensity: 0.5, verticality: 0.66, pressureBias: 'heavy' } },
    { id: 39, name: 'Neon Last Stand', biome: 'Glass City', targetKills: 72, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'SERPENT', 'BOMBER', 'DIVER', 'PTERO', 'GUARDIAN'], spawnGap: 0.44, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77400, reward: 275, terrainProfile: 'night-ambush', spawnPattern: ['DIVER', 'PTERO', 'RANGED', 'SERPENT', 'GUARDIAN', 'BOMBER'], levelModifiers: { routeStyle: 'ambush-switchbacks', hazardDensity: 0.56, verticality: 0.62, pressureBias: 'mixed' } },
    { id: 40, name: 'Gronk Prime', biome: 'Sky Forge', targetKills: 72, maxActive: 6, enemyKinds: ['CHASER', 'RANGED', 'HEAVY', 'SERPENT', 'BOMBER', 'DIVER', 'PTERO', 'GUARDIAN'], spawnGap: 0.44, runUpDistance: 1100, encounterSpacing: 450, levelLength: 77400, reward: 300, terrainProfile: 'sky-gauntlet', spawnPattern: ['GUARDIAN', 'PTERO', 'SERPENT', 'BOMBER', 'DIVER', 'HEAVY', 'RANGED'], levelModifiers: { routeStyle: 'sky-chains', hazardDensity: 0.56, verticality: 0.72, pressureBias: 'mixed' } },
];

export class GameScene extends Scene {
    public static selectedLevel: number = 0;

    public static selectLevel(level: number): void {
        const nextLevel = Math.floor(level);
        GameScene.selectedLevel = nextLevel <= 0 ? 0 : Math.min(LEVELS.length, Math.max(1, nextLevel));
    }

    private stage: Container;
    private uiLayer: Container;
    private overlayLayer: Container;
    private player: Player;
    private enemies: Enemy[] = [];
    private enemyGapManeuvers: WeakMap<Enemy, EnemyGapManeuver> = new WeakMap();
    private projectiles: Projectile[] = [];
    private playerProjectiles: Projectile[] = [];
    private bombExplosions: BombExplosion[] = [];
    private background: BackgroundManager;
    private hud: HUD;
    private particles: ParticleSystem;
    private level: LevelDefinition;
    
    private kills: number = 0;
    private gems: number = 0;
    private groundY: number;
    // Static layer: drawn ONCE per scene init / terrain rebuild. Holds ground
    // segments, gap walls, and platform geometry — none of which animate.
    private ground: Graphics;
    // Dynamic layer: cleared and redrawn whenever a hazard toggles active.
    // This used to live inside drawGround(), which forced a full redraw of
    // up to 76,000px of ground geometry every time any of 24 hazards
    // toggled at ~2.45rad/s. Splitting cuts the redraw to a few hundred
    // px of hazard outlines.
    private hazardOverlay: Graphics;
    private obstacleLayer: Container;
    private obstacleFrames: Texture[] = [];
    private terrainPlatforms: TerrainPlatform[] = [];
    private terrainGaps: TerrainGap[] = [];
    private hazards: Hazard[] = [];
    private resizeHandler: () => void;
    private messageHandler: (e: MessageEvent | any) => void;
    private spawnTimer: number = 0;
    private nextSpawnX: number = 0;
    private cameraX: number = 0;
    private isEndless: boolean = false;
    private endlessDepth: number = 1;
    private difficultyMultiplier: number = 1;
    private lastResolvedAttackId: number = -1;
    private hitThisAttack: Set<Enemy> = new Set();
    private state: 'PLAYING' | 'PAUSED' | 'LEVEL_COMPLETE' | 'DEAD' = 'PLAYING';
    private lastSafeX: number = 100;
    // Cooldown for the unwinnable-state failsafe so it doesn't yo-yo a
    // single enemy every frame.
    private unwinnableRescueCooldown: number = 0;
    private adReady: boolean = false;
    private adContinueUsed: boolean = false;
    private meleeWeapon: WeaponDefinition;
    private rangedWeapon: WeaponDefinition;
    private lastWeaponUnlocks: WeaponDefinition[] = [];
    private overlayButtonRegistry: OverlayButtonSnapshot[] = [];
    
    private shakeTimer: number = 0;
    private shakeIntensity: number = 0;

    constructor(engine: GameEngine) {
        super(engine);
        this.stage = new Container();
        this.uiLayer = new Container();
        this.overlayLayer = new Container();
        this.difficultyMultiplier = this.readDifficultyMultiplier();
        this.isEndless = GameScene.selectedLevel === 0;
        this.endlessDepth = Math.max(1, readNumber('gronk_endless_depth', 1));
        this.level = this.isEndless ? this.generateEndlessLevel(this.endlessDepth) : (LEVELS[GameScene.selectedLevel - 1] || LEVELS[0]);
        
        this.groundY = this.calculateGroundY();
        this.engine.physics.setGroundY(this.groundY);
        this.engine.physics.clearPlatforms();
        this.engine.physics.clearGroundGaps();
        this.terrainPlatforms = this.buildTerrainPlatforms();
        this.terrainGaps = this.buildTerrainGaps();
        this.hazards = this.buildHazards();
        for (const platform of this.terrainPlatforms) this.engine.physics.addPlatform(platform);
        this.engine.physics.setGroundGaps(this.terrainGaps);
        
        this.background = new BackgroundManager(this.stage, this.level.levelLength + window.innerWidth, window.innerHeight, this.level.biome);
        
        this.ground = new Graphics();
        this.hazardOverlay = new Graphics();
        this.obstacleLayer = new Container();
        this.drawGround();
        this.drawHazardOverlay();
        this.stage.addChild(this.ground);
        this.stage.addChild(this.hazardOverlay);
        this.stage.addChild(this.obstacleLayer);

        this.player = new Player();
        this.meleeWeapon = getEffectiveWeapon('melee');
        this.rangedWeapon = getEffectiveWeapon('ranged');
        this.player.applyWeaponLoadout(this.meleeWeapon, this.rangedWeapon);
        this.player.setWorldBounds(this.level.levelLength);
        this.hud = new HUD();
        this.particles = new ParticleSystem();
        
        this.resizeHandler = () => this.syncViewportLayout();
        this.messageHandler = (e: MessageEvent | any) => this.handleMessage(e);
    }

    public init(): void {
        this.engine.app.stage.addChild(this.stage);
        this.engine.app.stage.addChild(this.uiLayer);
        
        this.stage.addChild(this.player.view);
        this.stage.addChild(this.particles);
        this.uiLayer.addChild(this.hud);
        this.uiLayer.addChild(this.overlayLayer);
        
        this.engine.physics.addBody(this.player.body);
        window.addEventListener('resize', this.resizeHandler);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('message', this.messageHandler);
        document.addEventListener('message', this.messageHandler as EventListener);

        this.gems = readNumber('gronk_gems', 0);
        this.nextSpawnX = this.level.runUpDistance;

        this.spawnWave(true);
        this.updateHUD();
        this.publishNativeUiState(this.state === 'PLAYING');
    }

    private readDifficultyMultiplier(): number {
        const difficulty = readNumber('gronk_difficulty', 1);
        if (difficulty <= 0) return 0.82;
        if (difficulty >= 2) return 1.28;
        return 1;
    }

    private generateEndlessLevel(depth: number): LevelDefinition {
        const enemyPool: EnemyKind[] = ['CHASER'];
        if (depth >= 2) enemyPool.push('RANGED');
        if (depth >= 3) enemyPool.push('SERPENT', 'BOMBER');
        if (depth >= 4) enemyPool.push('HEAVY', 'DIVER');
        if (depth >= 5) enemyPool.push('PTERO');
        if (depth >= 6) enemyPool.push('GUARDIAN');

        const scaled = Math.max(1, depth * this.difficultyMultiplier);
        const biomeNames = ['Ruined Coast', 'Moonlit Road', 'Temple Jungle', 'Ash Ravine', 'Glass City', 'Sky Forge'];
        const biome = biomeNames[(depth - 1) % biomeNames.length];

        return {
            id: 0,
            name: `Endless Rift ${depth}`,
            biome,
            targetKills: Math.min(36, 5 + Math.floor(scaled * 1.8)),
            maxActive: Math.min(5, 2 + Math.floor(scaled / 4)),
            enemyKinds: enemyPool,
            spawnGap: Math.max(0.36, 0.82 - scaled * 0.025),
            runUpDistance: 720,
            encounterSpacing: Math.max(320, 520 - scaled * 8),
            levelLength: Math.min(78000, 30000 + Math.floor(scaled * 2800)),
            reward: 25 + depth * 8,
            terrainProfile: (['shore-sprint', 'witchline-crossfire', 'serpent-lanes', 'crossfire-ridge', 'iron-rush', 'sky-gauntlet'] as TerrainProfile[])[(depth - 1) % 6],
            spawnPattern: enemyPool.length === 1 ? ['CHASER', 'CHASER', 'CHASER'] : enemyPool,
            levelModifiers: {
                routeStyle: (['flat-pressure', 'crossfire-steps', 'low-serpent', 'hazard-ridge', 'rush-lanes', 'sky-chains'] as RouteStyle[])[(depth - 1) % 6],
                hazardDensity: Math.min(0.56, 0.12 + depth * 0.025),
                verticality: Math.min(0.72, 0.18 + depth * 0.035),
                pressureBias: enemyPool.includes('HEAVY') ? 'mixed' : enemyPool.includes('SERPENT') ? 'serpent' : enemyPool.includes('RANGED') ? 'ranged' : 'steady',
            },
        };
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (this.state === 'LEVEL_COMPLETE' && (e.code === 'Enter' || e.code === 'Space')) {
            this.goToNextLevel();
        } else if (this.state === 'DEAD' && (e.code === 'Enter' || e.code === 'Space')) {
            this.restartLevel();
        } else if (this.state === 'PAUSED' && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space')) {
            this.resumeGame();
        } else if (e.code === 'Escape') {
            this.showPause();
        }
    };

    private handleMessage(e: MessageEvent | any): void {
        try {
            const rawData = e.data || e;
            const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            if (data.type === 'backButton') {
                if (this.state === 'PAUSED') this.resumeGame();
                else if (this.state === 'PLAYING') this.showPause();
                return;
            }
            if (data.type === 'action' && data.name === 'pause') {
                if (this.state === 'PAUSED') this.resumeGame();
                else if (this.state === 'PLAYING') this.showPause();
                return;
            }
            if (data.type === 'adReady') {
                this.adReady = data.ready !== false;
                if (this.state === 'DEAD') this.drawDeadOverlay();
                return;
            }
            if (data.type === 'adNotReady' || data.type === 'adError') {
                this.adReady = false;
                if (data.type === 'adError') {
                    console.warn('Rewarded ad error:', data.code ?? 'unknown', data.message ?? '');
                }
                if (this.state === 'DEAD') this.drawDeadOverlay();
                return;
            }
            if (data.type === 'adRewarded') {
                if (data.rewardType === 'continue') this.applyRewardedContinue();
                return;
            }
            if (data.type === 'adClosed') {
                return;
            }
            if (data.type === 'debugSetKills') {
                this.kills = Math.max(0, Math.floor(Number.isFinite(data.kills) ? data.kills : this.kills));
                this.updateHUD();
                this.checkLevelCompletion();
                return;
            }
            if (data.type === 'debugClearEnemies') {
                for (const enemy of this.enemies) {
                    this.stage.removeChild(enemy.view);
                    this.engine.physics.removeBody(enemy.body);
                    this.enemyGapManeuvers.delete(enemy);
                }
                this.enemies = [];
                return;
            }
            if (data.type === 'debugSpawnEnemy') {
                const kind = this.normalizeEnemyKind(data.kind);
                const x = Number.isFinite(data.x) ? data.x : this.player.body.x + 520;
                const enemy = this.createEnemy(kind, x);
                if (Number.isFinite(data.y)) enemy.body.y = data.y;
                enemy.body.vx = Number.isFinite(data.vx) ? data.vx : enemy.body.vx;
                enemy.body.vy = Number.isFinite(data.vy) ? data.vy : enemy.body.vy;
                enemy.body.onGround = data.onGround !== false && enemy.body.gravityScale !== 0;
                enemy.body.groundedOn = enemy.body.onGround ? 'ground' : null;
                if (Number.isFinite(data.hp)) enemy.setHealthForDebug(data.hp);
                this.enemies.push(enemy);
                this.stage.addChild(enemy.view);
                this.engine.physics.addBody(enemy.body);
                return;
            }
            if (data.type !== 'debugSetPlayer') return;
            this.player.body.x = Number.isFinite(data.x) ? data.x : this.player.body.x;
            this.player.body.y = Number.isFinite(data.y) ? data.y : this.player.body.y;
            this.player.body.vx = Number.isFinite(data.vx) ? data.vx : this.player.body.vx;
            this.player.body.vy = Number.isFinite(data.vy) ? data.vy : this.player.body.vy;
            this.player.body.onGround = typeof data.onGround === 'boolean' ? data.onGround : false;
            if (data.clearHit === true) this.player.clearHitState();
            if (this.player.body.onGround) this.lastSafeX = this.player.body.x;
        } catch (error) {
            console.error('Failed to parse game scene message:', error);
        }
    }

    private calculateGroundY(): number {
        return Math.min(600, Math.max(220, window.innerHeight - 90));
    }

    // Static ground geometry — drawn once on init and on terrain rebuild.
    // Hazards are NOT drawn here; see drawHazardOverlay().
    private drawGround(): void {
        this.ground.clear();
        const topColor = this.level.id >= 8 ? 0x88e0ff : this.level.id >= 5 ? 0xffb347 : 0x50d6a8;
        const groundWidth = Math.max(this.level.levelLength + window.innerWidth, window.innerWidth * 2);
        const groundDepth = Math.max(160, window.innerHeight - this.groundY);
        const sortedGaps = [...this.terrainGaps].sort((a, b) => a.x - b.x);

        const drawSegment = (x: number, w: number) => {
            if (w <= 0) return;
            this.ground.rect(x, this.groundY, w, 18).fill(topColor);
            this.ground.rect(x, this.groundY + 18, w, groundDepth).fill(0x12131a);
            const firstMark = Math.ceil(x / 96) * 96;
            for (let i = firstMark; i < x + w; i += 96) {
                this.ground.rect(i, this.groundY + 18, 4, window.innerHeight).fill(this.level.id >= 5 ? 0x33241e : 0x16262e);
                this.ground.circle(i + 38, this.groundY + 38, 7).fill(0x263647);
            }
        };

        let segmentStart = 0;
        for (const gap of sortedGaps) {
            const gapStart = Math.max(0, Math.min(groundWidth, gap.x));
            const gapEnd = Math.max(gapStart, Math.min(groundWidth, gap.x + gap.w));
            drawSegment(segmentStart, gapStart - segmentStart);
            this.ground.rect(gapStart, this.groundY, gapEnd - gapStart, groundDepth + 120).fill(0x05070b);
            this.ground.rect(gapStart, this.groundY, 8, groundDepth).fill({ color: topColor, alpha: 0.66 });
            this.ground.rect(gapEnd - 8, this.groundY, 8, groundDepth).fill({ color: topColor, alpha: 0.66 });
            this.ground.rect(gapStart + 10, this.groundY + 22, Math.max(0, gapEnd - gapStart - 20), 8).fill({ color: 0xff4d6d, alpha: 0.32 });
            segmentStart = gapEnd;
        }
        drawSegment(segmentStart, groundWidth - segmentStart);

        for (const platform of this.terrainPlatforms) {
            this.ground.roundRect(platform.x, platform.y, platform.w, platform.h, 8).fill(topColor).stroke({ color: 0xffffff, width: 2, alpha: 0.24 });
            this.ground.rect(platform.x + 8, platform.y + platform.h, Math.max(12, platform.w - 16), 10).fill(this.level.id >= 5 ? 0x33241e : 0x16262e);
            for (let x = platform.x + 20; x < platform.x + platform.w - 8; x += 54) {
                this.ground.circle(x, platform.y + 10, 4).fill({ color: 0xffffff, alpha: 0.22 });
            }
        }
        this.renderObstacleSprites();
    }

    // Hazard overlay — small, drawn each time a hazard toggles active so we
    // don't pay for the full ground rebuild.
    private drawHazardOverlay(): void {
        this.hazardOverlay.clear();
        for (const hazard of this.hazards) {
            if (hazard.type === 'spikes') {
                this.hazardOverlay.roundRect(hazard.x, this.groundY - 8, hazard.w, 8, 4).fill({ color: 0x2d1720, alpha: 0.72 });
                this.hazardOverlay.rect(hazard.x + 5, this.groundY - 11, Math.max(0, hazard.w - 10), 3).fill({ color: 0xff4d6d, alpha: 0.22 });
            } else if (hazard.type === 'fireVent') {
                this.hazardOverlay.roundRect(hazard.x, this.groundY - 13, hazard.w, 13, 5).fill({ color: 0x3b1c12, alpha: 0.7 }).stroke({ color: 0xffd166, width: 1, alpha: hazard.active ? 0.52 : 0.28 });
                this.hazardOverlay.circle(hazard.x + hazard.w * 0.5, this.groundY - 13, hazard.active ? 24 : 10).fill({ color: hazard.active ? 0xff7a3d : 0xffd166, alpha: hazard.active ? 0.16 : 0.12 });
            } else {
                const cx = hazard.x + hazard.w * 0.5;
                this.hazardOverlay.circle(cx, this.groundY - 9, hazard.w * 0.42).fill({ color: 0x26144a, alpha: 0.42 }).stroke({ color: 0xc4b5fd, width: 2, alpha: hazard.active ? 0.68 : 0.34 });
                this.hazardOverlay.circle(cx, this.groundY - 22, hazard.active ? 18 : 10).fill({ color: 0x91e5ff, alpha: hazard.active ? 0.14 : 0.07 });
            }
        }
    }

    private getObstacleFrame(index: number): Texture {
        if (!this.obstacleFrames.length) {
            const base = Texture.from(OBSTACLE_SHEET.image);
            const frameW = OBSTACLE_SHEET.width / OBSTACLE_SHEET.cols;
            const frameH = OBSTACLE_SHEET.height / OBSTACLE_SHEET.rows;
            for (let i = 0; i < OBSTACLE_SHEET.cols * OBSTACLE_SHEET.rows; i++) {
                const col = i % OBSTACLE_SHEET.cols;
                const row = Math.floor(i / OBSTACLE_SHEET.cols);
                this.obstacleFrames.push(new Texture({
                    source: base.source,
                    frame: new Rectangle(col * frameW, row * frameH, frameW, frameH),
                }));
            }
        }
        return this.obstacleFrames[index] || this.obstacleFrames[0];
    }

    private renderObstacleSprites(): void {
        if (!this.obstacleLayer) return;
        this.obstacleLayer.removeChildren();
        for (const hazard of this.hazards) {
            const frame = this.getObstacleFrameIndex(hazard);
            const sprite = new Sprite(this.getObstacleFrame(frame));
            const anchor = this.getObstacleFrameAnchor(frame);
            sprite.anchor.set(anchor.x, anchor.y);
            sprite.x = hazard.x + hazard.w * 0.5;
            sprite.y = this.groundY + 6;
            if (hazard.type === 'spikes') {
                sprite.width = Math.max(108, hazard.w * 1.48);
                sprite.height = 74;
            } else if (hazard.type === 'fireVent') {
                sprite.width = Math.max(124, hazard.w * 1.72);
                sprite.height = hazard.active ? Math.max(132, hazard.h + 36) : 94;
            } else {
                sprite.width = Math.max(118, hazard.w * 1.56);
                sprite.height = hazard.active ? Math.max(118, hazard.h + 30) : 82;
            }
            this.obstacleLayer.addChild(sprite);
        }
    }

    private getObstacleFrameIndex(hazard: Hazard): number {
        if (hazard.type === 'spikes') {
            return Math.min(3, Math.max(0, Math.round((hazard.w - 56) / 24)));
        }
        if (hazard.type === 'fireVent') {
            if (!hazard.active) return 4;
            return 5 + (Math.floor(hazard.phase * OBSTACLE_SHEET.fps) % 3);
        }
        if (!hazard.active) return 8;
        return 9 + (Math.floor(hazard.phase * OBSTACLE_SHEET.fps) % 3);
    }

    private getObstacleFrameAnchor(frame: number): { x: number; y: number } {
        return OBSTACLE_FRAME_ANCHORS[frame] || { x: 0.5, y: 1 };
    }

    private buildTerrainPlatforms(): TerrainPlatform[] {
        const platforms: TerrainPlatform[] = [];
        const depth = this.isEndless ? this.endlessDepth : this.level.id;
        const modifiers = this.level.levelModifiers;
        const count = Math.min(24, Math.max(2, Math.floor((this.level.levelLength - 1200) / (1700 - modifiers.hazardDensity * 460)) + Math.floor(depth / 5)));
        const profile = this.level.terrainProfile;
        for (let i = 0; i < count; i++) {
            const x = 980 + i * Math.max(520, this.level.encounterSpacing + 170) + ((i * 137 + depth * 71) % 180);
            if (x > this.level.levelLength - 360) break;
            if (profile === 'shore-sprint' && i % 4 === 3) continue;
            const heightStep = (i + depth) % 3;
            const verticalBoost = modifiers.verticality * 40;
            let y = this.groundY - 86 - heightStep * (34 + verticalBoost * 0.22);
            let w = 170 + ((i + depth) % 3) * 34;
            if (profile === 'broken-steps') {
                y = this.groundY - 58 - (i % 4) * (28 + verticalBoost * 0.2);
                w = 150;
            } else if (profile === 'witchline-crossfire') {
                y = this.groundY - (i % 2 ? 156 + verticalBoost * 0.4 : 96 + verticalBoost * 0.2);
                w = 210;
            } else if (profile === 'serpent-lanes') {
                y = this.groundY - (i % 3 === 1 ? 122 + verticalBoost * 0.15 : 62);
                w = 250;
            } else if (profile === 'stone-guard') {
                y = this.groundY - 118 - (i % 3) * (20 + verticalBoost * 0.16);
                w = i % 2 ? 310 : 220;
            } else if (profile === 'crossfire-ridge') {
                y = this.groundY - (i % 4 === 1 ? 180 + verticalBoost * 0.45 : 104 + verticalBoost * 0.2);
                w = i % 2 ? 168 : 230;
            } else if (profile === 'golem-bridge') {
                y = this.groundY - 88 - (i % 3 === 2 ? verticalBoost * 0.35 : 0);
                w = i % 3 === 1 ? 380 : 330;
            } else if (profile === 'night-ambush') {
                y = this.groundY - (i % 2 ? 148 + verticalBoost * 0.42 : 78 + verticalBoost * 0.12);
                w = i % 3 === 0 ? 150 : 225;
            } else if (profile === 'iron-rush') {
                y = this.groundY - 72 - (i % 2) * (46 + verticalBoost * 0.22);
                w = i % 4 === 0 ? 250 : 185;
            } else if (profile === 'sky-gauntlet') {
                y = this.groundY - 166 - verticalBoost * 0.5 + (i % 3) * 32;
                w = i % 2 ? 150 : 205;
            }
            if (modifiers.routeStyle === 'rush-lanes' && i % 5 === 2) w += 70;
            if (modifiers.routeStyle === 'ambush-switchbacks' && i % 4 === 0) y -= verticalBoost * 0.45;
            platforms.push({
                x,
                y: Math.max(120, y),
                w,
                h: 18,
            });
        }
        return platforms;
    }

    private buildTerrainGaps(): TerrainGap[] {
        const gaps: TerrainGap[] = [];
        const depth = this.isEndless ? this.endlessDepth : this.level.id;
        const modifiers = this.level.levelModifiers;
        const spacing = Math.max(1500, 2850 - modifiers.hazardDensity * 1200 - modifiers.verticality * 260);
        const count = Math.min(18, Math.max(1, Math.floor((this.level.levelLength - 1800) / spacing)));
        const startX = 1420 + depth * 17;

        for (let i = 0; i < count; i++) {
            let x = startX + i * spacing + ((i * 193 + depth * 89) % 340);
            if (modifiers.routeStyle === 'sky-chains' && i % 3 === 1) x += 180;
            if (modifiers.routeStyle === 'rush-lanes' && i % 4 === 2) x += 120;
            if (x > this.level.levelLength - 720) break;

            const widthBoost = modifiers.routeStyle === 'sky-chains' ? 34 : modifiers.routeStyle === 'hazard-ridge' ? 22 : 0;
            const w = Math.min(238, 126 + ((i + depth) % 3) * 24 + modifiers.hazardDensity * 58 + widthBoost);
            gaps.push({
                x,
                w,
                depth: Math.min(260, 170 + modifiers.verticality * 105 + (i % 2) * 24),
            });
        }

        return gaps;
    }

    private buildHazards(): Hazard[] {
        const hazards: Hazard[] = [];
        const depth = this.isEndless ? this.endlessDepth : this.level.id;
        const modifiers = this.level.levelModifiers;
        const spacing = Math.max(980, 2600 - modifiers.hazardDensity * 1500);
        const count = Math.min(24, Math.max(2, Math.floor((this.level.levelLength - 1800) / spacing)));

        for (let i = 0; i < count; i++) {
            let x = 1160 + i * spacing + ((i * 149 + depth * 53) % 300);
            if (x > this.level.levelLength - 520) break;
            x = this.pushAwayFromGap(x, 120);

            const spellRune = (i + depth) % 5 === 3 || (modifiers.routeStyle === 'sky-chains' && i % 4 === 1) || (this.level.biome.includes('Moonlit') && i % 3 === 2);
            const fireVent = !spellRune && ((i + depth) % 4 === 2 || modifiers.routeStyle === 'hazard-ridge' && i % 3 === 1);
            if (spellRune) {
                const h = 68 + modifiers.verticality * 34;
                hazards.push({
                    type: 'spellRune',
                    x,
                    y: this.groundY - h,
                    w: 72,
                    h,
                    damage: 16,
                    active: (i + depth) % 2 === 1,
                    phase: i * 0.55 + depth * 0.42,
                });
            } else if (fireVent) {
                const h = 104 + modifiers.hazardDensity * 46;
                hazards.push({
                    type: 'fireVent',
                    x,
                    y: this.groundY - h,
                    w: 58,
                    h,
                    damage: 14,
                    active: (i + depth) % 2 === 0,
                    phase: i * 0.72 + depth * 0.35,
                });
            } else {
                const w = 64 + ((i + depth) % 3) * 18;
                hazards.push({
                    type: 'spikes',
                    x,
                    y: this.groundY - 30,
                    w,
                    h: 30,
                    damage: 12,
                    active: true,
                    phase: 0,
                });
            }
        }

        return hazards;
    }

    private pushAwayFromGap(x: number, padding: number): number {
        let safeX = x;
        for (const gap of this.terrainGaps) {
            if (safeX + padding < gap.x || safeX > gap.x + gap.w + padding) continue;
            safeX = gap.x + gap.w + padding;
        }
        return Math.min(this.level.levelLength - 360, safeX);
    }

    private syncViewportLayout(): void {
        const nextGroundY = this.calculateGroundY();
        if (nextGroundY === this.groundY) return;
        this.groundY = nextGroundY;
        this.engine.physics.setGroundY(this.groundY);
        this.engine.physics.clearPlatforms();
        this.engine.physics.clearGroundGaps();
        this.terrainPlatforms = this.buildTerrainPlatforms();
        this.terrainGaps = this.buildTerrainGaps();
        this.hazards = this.buildHazards();
        for (const platform of this.terrainPlatforms) this.engine.physics.addPlatform(platform);
        this.engine.physics.setGroundGaps(this.terrainGaps);
        this.drawGround();
        this.drawHazardOverlay();
        this.player.setWorldBounds(this.level.levelLength);
        this.player.body.y = Math.min(this.player.body.y, this.groundY - this.player.body.h);
        for (const enemy of this.enemies) {
            enemy.body.y = Math.min(enemy.body.y, this.groundY - enemy.body.h);
        }
    }

    private spawnWave(initial: boolean = false): void {
        if (this.state !== 'PLAYING') return;
        const pressureCap = this.hasMetLevelGoal() ? Math.min(2, this.level.maxActive) : this.level.maxActive;
        const remainingObjectiveSlots = this.hasMetLevelGoal()
            ? pressureCap
            : this.level.targetKills - this.kills - this.enemies.length;
        const needed = Math.min(pressureCap - this.enemies.length, remainingObjectiveSlots);
        if (needed <= 0) return;

        const startingEnemyCount = this.enemies.length;
        for (let i = 0; i < needed; i++) {
            const pattern = this.level.spawnPattern.length ? this.level.spawnPattern : this.level.enemyKinds;
            const kind = pattern[(this.kills + startingEnemyCount + i) % pattern.length];
            const spacing = initial ? 150 : 120;
            const minVisibleAhead = this.player.body.x + 520;
            const maxSpawnX = this.level.levelLength - 180;
            const x = this.getSafeSpawnX(Math.min(maxSpawnX, Math.max(this.nextSpawnX, minVisibleAhead) + i * spacing + Math.random() * 40));
            const enemy = this.createEnemy(kind, x);
            this.enemies.push(enemy);
            this.stage.addChild(enemy.view);
            this.engine.physics.addBody(enemy.body);
        }
        this.nextSpawnX = Math.min(this.level.levelLength - 180, this.nextSpawnX + this.level.encounterSpacing);
    }

    private getSafeSpawnX(x: number): number {
        let safeX = x;
        for (const gap of this.terrainGaps) {
            if (safeX < gap.x - 80 || safeX > gap.x + gap.w + 80) continue;
            safeX = gap.x + gap.w + 130;
        }
        for (const hazard of this.hazards) {
            if (safeX < hazard.x - 70 || safeX > hazard.x + hazard.w + 70) continue;
            safeX = hazard.x + hazard.w + 120;
        }
        return Math.min(this.level.levelLength - 180, safeX);
    }

    private createEnemy(kind: EnemyKind, x: number): Enemy {
        const y = this.groundY - 90;
        if (kind === 'RANGED') return new RangedEnemy(x, y);
        if (kind === 'HEAVY') return new HeavyEnemy(x, this.groundY - 110);
        if (kind === 'SERPENT') return new SerpentEnemy(x, this.groundY - 58);
        if (kind === 'BOMBER') return new BomberEnemy(x, this.groundY - 76);
        if (kind === 'DIVER') return new DiverEnemy(x, this.groundY - 238);
        if (kind === 'PTERO') return new PteroEnemy(x, this.groundY - 252);
        if (kind === 'GUARDIAN') return new GuardianEnemy(x, this.groundY - 96);
        return new Enemy(x, y, 'CHASER');
    }

    private normalizeEnemyKind(kind: unknown): EnemyKind {
        const kinds: EnemyKind[] = ['CHASER', 'RANGED', 'HEAVY', 'SERPENT', 'BOMBER', 'DIVER', 'PTERO', 'GUARDIAN'];
        return kinds.includes(kind as EnemyKind) ? kind as EnemyKind : 'CHASER';
    }

    private applyShake(intensity: number, duration: number): void {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    public updateLogic(dt: number): void {
        if (this.state !== 'PLAYING') return;

        if (this.player.hp <= 0) {
            this.showDead();
            return;
        }

        this.player.update(dt, this.engine.input);
        this.updateCamera();
        this.background.update(dt, this.cameraX);
        this.particles.update(dt);
        this.updateHazards(dt);
        this.updateLastSafePosition();
        this.checkHazards();
        this.checkPitFall();
        if (this.state !== 'PLAYING') return;

        if (this.player.hp <= 0) {
            this.showDead();
            return;
        }

        if (this.player.attackId !== this.lastResolvedAttackId) {
            this.lastResolvedAttackId = this.player.attackId;
            this.hitThisAttack.clear();
        }

        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.stage.position.set(-this.cameraX + (Math.random() - 0.5) * this.shakeIntensity, (Math.random() - 0.5) * this.shakeIntensity);
        } else {
            this.stage.position.set(-this.cameraX, 0);
        }

        this.updateProjectiles(dt);
        this.updatePlayerProjectiles(dt);
        this.updateBombExplosions(dt);
        this.updateEnemies(dt);

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.player.body.x + window.innerWidth * 0.78 >= this.nextSpawnX) {
            this.spawnTimer = this.level.spawnGap;
            this.spawnWave();
        }

        this.checkLevelCompletion();
    }

    private updateHazards(dt: number): void {
        let needsHazardRedraw = false;
        let needsSpriteRedraw = false;
        for (const hazard of this.hazards) {
            hazard.phase += dt;
            const wasActive = hazard.active;
            if (hazard.type === 'fireVent') {
                hazard.active = Math.sin(hazard.phase * 2.45) > -0.12;
                hazard.h = hazard.active ? 104 + this.level.levelModifiers.hazardDensity * 46 : 24;
                needsSpriteRedraw = true;
            } else if (hazard.type === 'spellRune') {
                hazard.active = Math.sin(hazard.phase * 3.1) > 0.24;
                hazard.h = hazard.active ? 68 + this.level.levelModifiers.verticality * 34 : 30;
                needsSpriteRedraw = true;
            } else {
                continue;
            }
            hazard.y = this.groundY - hazard.h;
            if (wasActive !== hazard.active) needsHazardRedraw = true;
        }
        // Was: drawGround() rebuilt the entire 76,000px level on every toggle.
        // Now: only the hazard overlay (small) is rebuilt; static ground is untouched.
        if (needsHazardRedraw) this.drawHazardOverlay();
        if (needsSpriteRedraw) this.renderObstacleSprites();
    }

    private updateLastSafePosition(): void {
        if (!this.player.body.onGround) return;
        if (this.isBodyOverGap(this.player.body)) return;
        if (this.hazards.some((hazard) => hazard.active && this.overlaps(this.player.body, hazard, 2))) return;
        this.lastSafeX = Math.max(80, this.player.body.x);
    }

    private checkHazards(): void {
        if (this.player.isHit) return;
        for (const hazard of this.hazards) {
            if (!hazard.active) continue;
            if (!this.overlaps(this.player.body, hazard, 2)) continue;
            this.player.takeDamage(hazard.damage, this.player.body.x < hazard.x ? -1 : 1);
            SoundManager.playCue('damage');
            this.applyShake(12, 0.16);
            this.updateHUD();
            return;
        }
    }

    private checkPitFall(): void {
        if (this.player.body.y < this.groundY + 170) return;
        this.player.hp = 0;
        this.player.body.vx = 0;
        this.player.body.vy = 0;
        this.player.body.onGround = false;
        SoundManager.playCue('damage');
        this.applyShake(18, 0.2);
        this.updateHUD();
        this.showDead();
    }

    private isBodyOverGap(body: { x: number; w: number }): boolean {
        const footCenterX = body.x + body.w * 0.5;
        return this.terrainGaps.some((gap) => footCenterX > gap.x && footCenterX < gap.x + gap.w);
    }

    private checkLevelCompletion(): void {
        if (this.hasMetLevelGoal()) {
            this.completeLevel();
            return;
        }
        this.preventUnwinnableState();
    }

    // Failsafe against soft-locks: if the player still owes kills but no enemy
    // is reachable from BEHIND (legitimately-ahead enemies are fine, they'll
    // be encountered by forward progress), nudge a stuck enemy toward the
    // player. Skips flyers — yanking a Ptero or Diver to ground level breaks
    // their AI and gives the player a free sitting target. Cooldown prevents
    // per-frame yo-yo on a single enemy.
    private preventUnwinnableState(): void {
        if (this.kills >= this.level.targetKills) return;
        if (this.unwinnableRescueCooldown > 0) {
            // checkLevelCompletion runs each tick; rough dt is fine here.
            this.unwinnableRescueCooldown -= 1 / 60;
            return;
        }
        const playerCenterX = this.player.body.x + this.player.body.w * 0.5;
        const reachable = this.enemies.some((enemy) => {
            const dx = enemy.body.x + enemy.body.w * 0.5 - playerCenterX;
            // Anything within 1500 ahead OR up to 1500 behind counts as
            // reachable; only "stranded" means everyone is far behind.
            return dx > -1500 && dx < 1500;
        });
        if (reachable) return;
        // Pick the closest BEHIND-the-player non-flyer.
        const candidates = this.enemies.filter((e) => {
            if (e.type === 'PTERO' || e.type === 'DIVER') return false;
            const dx = e.body.x + e.body.w * 0.5 - playerCenterX;
            return dx <= -1500;
        });
        if (candidates.length > 0) {
            const closest = candidates.reduce((a, b) => {
                const da = Math.abs(a.body.x + a.body.w * 0.5 - playerCenterX);
                const db = Math.abs(b.body.x + b.body.w * 0.5 - playerCenterX);
                return da < db ? a : b;
            });
            const targetX = Math.min(this.level.levelLength - 240, this.player.body.x + 520);
            closest.body.x = targetX;
            closest.body.y = this.groundY - closest.body.h;
            closest.body.vx = 0;
            closest.body.vy = 0;
            closest.body.onGround = true;
            closest.body.groundedOn = 'ground';
            this.unwinnableRescueCooldown = 2.0;
            return;
        }
        // No reachable non-flyer enemies at all — force the spawn gate to
        // fire next frame so the spawnWave path runs (which uses the
        // type-correct constructors for any enemy kind including flyers).
        if (this.enemies.length === 0 || this.enemies.every((e) => e.type === 'PTERO' || e.type === 'DIVER')) {
            this.spawnTimer = 0;
            this.nextSpawnX = Math.min(this.nextSpawnX, this.player.body.x + 320);
            this.unwinnableRescueCooldown = 1.0;
        }
    }

    private hasMetLevelGoal(): boolean {
        return this.kills >= this.level.targetKills;
    }

    private updateCamera(): void {
        const target = Math.max(0, this.player.body.x - window.innerWidth * 0.34);
        const maxCamera = Math.max(0, this.level.levelLength - window.innerWidth);
        this.cameraX += (Math.min(maxCamera, target) - this.cameraX) * 0.14;
        this.stage.x = -this.cameraX;
        this.stage.y = 0;
    }

    private updateProjectiles(dt: number): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            if (p.isDead) {
                if (p.explosionRadius > 0 && !p.hasExploded) this.detonateBomb(p);
                this.stage.removeChild(p.view);
                this.engine.physics.removeBody(p.body);
                this.projectiles.splice(i, 1);
                continue;
            }
            
            if (this.player.isCrouching && p.highProjectile) {
                continue;
            }

            if (!this.player.isHit && this.overlaps(this.player.body, p.body, 8)) {
                if (p.explosionRadius > 0) {
                    this.detonateBomb(p);
                } else {
                    this.player.takeDamage(p.damage, Math.sign(this.player.body.x - p.body.x) || -1);
                    this.applyShake(15, 0.2);
                }
                p.isDead = true;
            }
        }
    }

    private detonateBomb(projectile: Projectile): void {
        if (projectile.hasExploded) return;
        projectile.hasExploded = true;
        const radius = Math.max(70, projectile.explosionRadius);
        const x = projectile.body.x + projectile.body.w * 0.5;
        const y = projectile.body.y + projectile.body.h * 0.5;
        const view = new Graphics();
        view.circle(0, 0, radius).fill({ color: 0xff7a3d, alpha: 0.22 }).stroke({ color: 0xffd166, width: 4, alpha: 0.72 });
        view.circle(0, 0, radius * 0.46).fill({ color: 0xfff1a8, alpha: 0.28 });
        view.position.set(x, y);
        this.stage.addChild(view);
        this.bombExplosions.push({ x, y, radius, life: 0.32, maxLife: 0.32, view });
        this.particles.spawn(x, y, 0xffa05a, 18);

        const playerCenterX = this.player.body.x + this.player.body.w * 0.5;
        const playerCenterY = this.player.body.y + this.player.body.h * 0.5;
        const distance = Math.hypot(playerCenterX - x, playerCenterY - y);
        if (!this.player.isHit && distance <= radius) {
            const falloff = 1 - Math.min(0.55, distance / Math.max(1, radius) * 0.45);
            this.player.takeDamage(Math.round(projectile.damage * falloff), playerCenterX < x ? -1 : 1);
            SoundManager.playCue('damage');
            this.applyShake(20, 0.24);
            this.updateHUD();
        } else {
            this.applyShake(9, 0.12);
        }
    }

    private updateBombExplosions(dt: number): void {
        for (let i = this.bombExplosions.length - 1; i >= 0; i--) {
            const explosion = this.bombExplosions[i];
            explosion.life -= dt;
            const pct = Math.max(0, explosion.life / explosion.maxLife);
            explosion.view.alpha = pct;
            explosion.view.scale.set(1 + (1 - pct) * 0.38);
            if (explosion.life <= 0) {
                this.stage.removeChild(explosion.view);
                this.bombExplosions.splice(i, 1);
            }
        }
    }

    private updatePlayerProjectiles(dt: number): void {
        if (this.player.consumeRangedShot()) {
            SoundManager.playCue('ranged');
            const dir = this.player.facingRight ? 1 : -1;
            const x = this.player.facingRight ? this.player.body.x + this.player.body.w + 10 : this.player.body.x - 20;
            const y = this.player.body.y + 31;
            const p = new Projectile(x, y, dir * this.player.rangedProjectileSpeed, 0, 0x91e5ff, 0, this.player.rangedDamage, this.level.levelLength + window.innerWidth);
            p.body.w = 18;
            p.body.h = 8;
            p.view.clear();
            p.view.roundRect(0, 0, 18, 8, 4).fill(0x91e5ff).stroke({ color: 0xffffff, width: 1, alpha: 0.7 });
            this.playerProjectiles.push(p);
            this.stage.addChild(p.view);
            this.engine.physics.addBody(p.body);
            this.particles.spawn(x, y + 4, 0x91e5ff, 6);
        }

        for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
            const p = this.playerProjectiles[i];
            p.update(dt);

            for (const enemy of this.enemies) {
                if (enemy.isDead || p.isDead) continue;
                if (!this.overlaps(p.body, enemy.body, 4)) continue;

                enemy.takeDamage(p.damage, Math.sign(p.body.vx) || 1);
                p.isDead = true;
                this.applyShake(7, 0.08);
                this.particles.spawn(enemy.body.x + enemy.body.w / 2, enemy.body.y + enemy.body.h / 2, 0x91e5ff, 10);
                if (enemy.isDead) this.registerKill(enemy);
                this.updateHUD();
            }

            if (p.isDead) {
                this.stage.removeChild(p.view);
                this.engine.physics.removeBody(p.body);
                this.playerProjectiles.splice(i, 1);
            }
        }
    }

    private updateEnemies(dt: number): void {
        // Snapshot the player target ONCE per frame instead of allocating a
        // fresh object per enemy per frame. With 5 enemies at 60fps that was
        // 300 throwaway objects/sec; now it's 60.
        const targetSnapshot = this.getEnemyTargetSnapshot();
        for (const enemy of this.enemies) {
            enemy.update(dt, targetSnapshot);
            if (enemy.isDead) continue;
            this.resolveEnemyPitFall(enemy);
            if (enemy.isDead) continue;
            if (!enemy.hasPlayerKnockbackCredit()) this.avoidEnemyGroundGaps(enemy, dt);

            if ((enemy as any).pendingShot) {
                (enemy as any).pendingShot = false;
                const lead = Number.isFinite((enemy as RangedEnemy).pendingShotLead) ? (enemy as RangedEnemy).pendingShotLead : 0;
                const aimX = this.player.body.x + this.player.body.w * 0.5 + lead;
                const dir = aimX < enemy.body.x ? -1 : 1;
                const speed = 420 + Math.min(120, Math.abs(lead) * 0.45);
                const highProjectile = (enemy as RangedEnemy).pendingShotHigh !== false;
                const p = new Projectile(enemy.body.x, enemy.body.y + (highProjectile ? 18 : 40), dir * speed, highProjectile ? -28 : -12, 0xffff00, 0.08, 10, this.level.levelLength + window.innerWidth, highProjectile);
                this.projectiles.push(p);
                this.stage.addChild(p.view);
                this.engine.physics.addBody(p.body);
            }

            if ((enemy as any).pendingBomb) {
                (enemy as BomberEnemy).pendingBomb = false;
                const targetX = this.player.body.x + this.player.body.w * 0.5;
                const dir = targetX < enemy.body.x ? -1 : 1;
                const p = new Projectile(enemy.body.x + enemy.body.w * 0.5, enemy.body.y + 18, dir * 255, -430, 0x171923, 0.78, 16, this.level.levelLength + window.innerWidth, false);
                p.body.w = 24;
                p.body.h = 24;
                p.explosionRadius = 122;
                p.view.clear();
                p.view.circle(12, 12, 12).fill(0x171923).stroke({ color: 0xffd166, width: 3, alpha: 0.95 });
                p.view.circle(17, 7, 3).fill(0xff7a3d);
                this.projectiles.push(p);
                this.stage.addChild(p.view);
                this.engine.physics.addBody(p.body);
            }

            const playerCanHurt = this.player.canDealAttackDamage();
            if (playerCanHurt && this.attackOverlaps(enemy) && !this.hitThisAttack.has(enemy)) {
                this.hitThisAttack.add(enemy);
                SoundManager.playCue('melee');
                enemy.takeDamage(this.player.meleeDamage, this.player.facingRight ? 1 : -1);
                SoundManager.playCue('hit');
                this.applyShake(10, 0.1);
                this.particles.spawn(enemy.body.x + enemy.body.w / 2, enemy.body.y + enemy.body.h / 2, 0xfff1a8, 12);
                if (enemy.isDead) this.registerKill(enemy);
                this.updateHUD();
                continue;
            }

            if (this.player.canDealPoundDamage() && this.overlaps(this.player.body, enemy.body, 6) && !this.hitThisAttack.has(enemy)) {
                this.hitThisAttack.add(enemy);
                SoundManager.playCue('hit');
                // Pound damage scales with the equipped melee weapon so upgrades
                // like Sky Maul actually matter. Slight bonus over melee for the
                // commitment of being airborne.
                const poundDamage = Math.round(this.player.meleeDamage * 1.15);
                enemy.takePoundDamage(poundDamage, this.player.facingRight ? 1 : -1);
                this.player.body.vy = -360;
                this.player.isPounding = false;
                this.applyShake(14, 0.12);
                this.particles.spawn(enemy.body.x + enemy.body.w / 2, enemy.body.y + 8, 0xffa05a, 14);
                if (enemy.isDead) this.registerKill(enemy);
                this.updateHUD();
                continue;
            }

            if (!this.player.isHit && enemy.canDealContactDamage() && this.overlaps(this.player.body, enemy.body, 4)) {
                this.player.takeDamage(10, this.player.body.x < enemy.body.x ? -1 : 1);
                SoundManager.playCue('damage');
                this.applyShake(15, 0.2);
                this.updateHUD();
            }
        }

        this.enemies = this.enemies.filter((enemy) => {
            if (!enemy.isDead) return true;
            this.stage.removeChild(enemy.view);
            this.engine.physics.removeBody(enemy.body);
            return false;
        });
    }

    private resolveEnemyPitFall(enemy: Enemy): void {
        if (enemy.body.gravityScale === 0) return;
        if (enemy.body.y <= this.groundY + 120) return;
        const currentGap = this.findGroundGapAt(enemy.body.x + enemy.body.w * 0.5);
        if (!currentGap) return;

        enemy.isDead = true;
        this.enemyGapManeuvers.delete(enemy);
        const shouldCreditKill = enemy.hasPlayerKnockbackCredit() || enemy.hasTakenDamage();
        if (shouldCreditKill) {
            this.registerKill(enemy);
            this.updateHUD();
        }
        this.requestObjectiveReplacementSpawn();
    }

    private requestObjectiveReplacementSpawn(): void {
        if (this.hasMetLevelGoal()) return;
        this.spawnTimer = 0;
        this.nextSpawnX = Math.min(this.nextSpawnX, this.player.body.x + 320);
    }

    private getEnemyTargetSnapshot(): EnemyTargetSnapshot {
        return {
            x: this.player.body.x,
            y: this.player.body.y,
            vx: this.player.body.vx,
            vy: this.player.body.vy,
            onGround: this.player.body.onGround,
            width: this.player.body.w,
            height: this.player.body.h,
        };
    }

    private avoidEnemyGroundGaps(enemy: Enemy, dt: number): void {
        if (enemy.body.gravityScale === 0) return;
        const vx = enemy.body.vx;
        if (Math.abs(vx) < 20) return;
        const dir = Math.sign(vx);
        const activeManeuver = this.enemyGapManeuvers.get(enemy);
        if (activeManeuver && activeManeuver.timer > 0) {
            activeManeuver.timer = Math.max(0, activeManeuver.timer - dt);
            if (activeManeuver.action === 'gap-retreat') {
                enemy.body.vx = -activeManeuver.dir * Math.max(145, Math.abs(vx) * 0.82);
                enemy.sprite.setState('RUN');
                return;
            }
            if (activeManeuver.action === 'gap-vault') {
                enemy.body.vx = activeManeuver.dir * Math.max(315, Math.abs(vx));
                if (!enemy.body.onGround || activeManeuver.timer > 0.28) return;
                this.enemyGapManeuvers.set(enemy, {
                    action: 'gap-recover',
                    timer: 0.22,
                    dir: activeManeuver.dir,
                    gapX: activeManeuver.gapX,
                    gapW: activeManeuver.gapW,
                });
                return;
            }
            if (activeManeuver.action === 'gap-recover') {
                enemy.body.vx = activeManeuver.dir * Math.max(150, Math.abs(vx) * 0.58);
                return;
            }
        } else if (activeManeuver) {
            this.enemyGapManeuvers.delete(enemy);
        }

        const currentGap = this.findGroundGapAt(enemy.body.x + enemy.body.w * 0.5);
        if (currentGap && enemy.body.y + enemy.body.h >= this.groundY - 18) {
            const gapCenter = currentGap.x + currentGap.w * 0.5;
            const retreatDir = enemy.body.x + enemy.body.w * 0.5 < gapCenter ? -1 : 1;
            enemy.body.x = retreatDir < 0 ? currentGap.x - enemy.body.w - 8 : currentGap.x + currentGap.w + 8;
            enemy.body.y = this.groundY - enemy.body.h;
            enemy.body.vx = retreatDir * Math.max(110, Math.abs(vx));
            enemy.body.vy = 0;
            enemy.body.onGround = true;
            enemy.body.groundedOn = 'ground';
            this.enemyGapManeuvers.set(enemy, {
                action: 'gap-recover',
                timer: 0.28,
                dir: retreatDir,
                gapX: currentGap.x,
                gapW: currentGap.w,
            });
            return;
        }

        const lookAhead = enemy.body.w * 0.5 + Math.min(92, Math.max(42, Math.abs(vx) * 0.16));
        const frontX = dir > 0 ? enemy.body.x + enemy.body.w + lookAhead : enemy.body.x - lookAhead;
        const upcomingGap = this.findGroundGapAt(frontX);
        if (!upcomingGap) return;

        if (enemy.body.onGround && upcomingGap.w <= 280) {
            const vaultSpeed = Math.min(560, Math.max(330, Math.abs(vx) + upcomingGap.w * 0.9));
            const vaultLift = -Math.min(690, Math.max(520, 440 + upcomingGap.w * 0.72));
            enemy.body.vx = dir * vaultSpeed;
            enemy.body.vy = vaultLift;
            enemy.body.onGround = false;
            enemy.body.groundedOn = null;
            this.enemyGapManeuvers.set(enemy, {
                action: 'gap-vault',
                timer: 0.86,
                dir,
                gapX: upcomingGap.x,
                gapW: upcomingGap.w,
            });
            return;
        }

        enemy.body.vx = -dir * Math.max(120, Math.abs(vx) * 0.72);
        this.enemyGapManeuvers.set(enemy, {
            action: 'gap-retreat',
            timer: 0.58,
            dir,
            gapX: upcomingGap.x,
            gapW: upcomingGap.w,
        });
    }

    private findGroundGapAt(x: number): TerrainGap | null {
        return this.terrainGaps.find((gap) => x >= gap.x - 16 && x <= gap.x + gap.w + 16) || null;
    }

    private isEnemyNearGroundGap(enemy: Enemy): boolean {
        if (enemy.body.gravityScale === 0) return false;
        const dir = enemy.body.vx >= 0 ? 1 : -1;
        const lookAhead = enemy.body.w * 0.5 + Math.min(92, Math.max(42, Math.abs(enemy.body.vx) * 0.16));
        const frontX = dir > 0 ? enemy.body.x + enemy.body.w + lookAhead : enemy.body.x - lookAhead;
        return this.findGroundGapAt(enemy.body.x + enemy.body.w * 0.5) !== null
            || this.findGroundGapAt(frontX) !== null;
    }

    private gapAction(enemy: Enemy): EnemyGapAction {
        const maneuver = this.enemyGapManeuvers.get(enemy);
        if (!maneuver || maneuver.timer <= 0) return 'none';
        return maneuver.action;
    }

    private registerKill(enemy: Enemy): void {
        this.kills++;
        this.gems += 5;
        this.particles.spawn(enemy.body.x + enemy.body.w / 2, enemy.body.y + enemy.body.h / 2, 0xffd700, 16);
        writeNumber('gronk_gems', this.gems);
    }

    private attackOverlaps(enemy: Enemy): boolean {
        const range = this.player.attackRange;
        const minX = this.player.facingRight ? this.player.body.x + this.player.body.w - 6 : this.player.body.x - range;
        const maxX = this.player.facingRight ? this.player.body.x + this.player.body.w + range : this.player.body.x + 6;
        const verticalPad = 78;
        return enemy.body.x < maxX
            && enemy.body.x + enemy.body.w > minX
            && enemy.body.y < this.player.body.y + this.player.body.h + verticalPad
            && enemy.body.y + enemy.body.h > this.player.body.y - verticalPad;
    }

    private overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad: number = 0): boolean {
        return a.x < b.x + b.w + pad
            && a.x + a.w + pad > b.x
            && a.y < b.y + b.h + pad
            && a.y + a.h + pad > b.y;
    }

    private completeLevel(): void {
        this.state = 'LEVEL_COMPLETE';
        this.engine.input.clearActions();
        this.publishNativeUiState();
        SoundManager.playCue('clear');
        if (this.isEndless) {
            writeNumber('gronk_endless_depth', this.endlessDepth + 1);
        } else {
            const unlocked = Math.max(readNumber('gronk_unlocked_level', 1), Math.min(LEVELS.length, this.level.id + 1));
            writeNumber('gronk_unlocked_level', unlocked);
        }
        this.gems += this.level.reward;
        writeNumber('gronk_gems', this.gems);
        this.lastWeaponUnlocks = this.isEndless ? [] : grantWeaponsForLevel(this.level.id);
        this.updateHUD();
        const unlockText = this.lastWeaponUnlocks.length ? `UNLOCKED ${this.lastWeaponUnlocks.map((weapon) => weapon.name).join(' + ')}` : '';
        this.drawResultOverlay(this.isEndless ? 'RIFT CLEAR' : 'LEVEL CLEAR', `${this.level.name} complete`, this.isEndless ? 'ENTER / TAP: NEXT RIFT' : 'ENTER / TAP: NEXT LEVEL', unlockText);
    }

    private showDead(): void {
        this.state = 'DEAD';
        this.engine.input.clearActions();
        this.publishNativeUiState();
        this.drawDeadOverlay();
    }

    private showPause(): void {
        if (this.state !== 'PLAYING') return;
        this.state = 'PAUSED';
        this.engine.paused = true;
        this.engine.input.clearActions();
        this.publishNativeUiState();
        this.drawPauseOverlay();
    }

    private resumeGame(): void {
        if (this.state !== 'PAUSED') return;
        this.state = 'PLAYING';
        this.engine.paused = false;
        this.engine.input.clearActions();
        this.publishNativeUiState();
        this.overlayLayer.removeChildren();
        this.overlayLayer.removeAllListeners('pointerdown');
        this.overlayButtonRegistry = [];
    }

    private drawPauseOverlay(): void {
        this.overlayLayer.removeChildren();
        this.overlayButtonRegistry = [];
        const shade = new Graphics();
        shade.rect(0, 0, window.innerWidth, window.innerHeight).fill({ color: 0x05070b, alpha: 0.62 });
        this.overlayLayer.addChild(shade);

        const panelW = Math.min(560, window.innerWidth - 48);
        const panelH = 300;
        const panelX = (window.innerWidth - panelW) / 2;
        const panelY = Math.max(34, (window.innerHeight - panelH) / 2);
        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 12).fill(0x101822).stroke({ color: 0xc4b5fd, width: 2 });
        this.overlayLayer.addChild(panel);

        const titleText = new Text({ text: 'PAUSED', style: new TextStyle({ fill: 0xffffff, fontSize: 42, fontWeight: 'bold' }) });
        titleText.anchor.set(0.5);
        titleText.position.set(window.innerWidth / 2, panelY + 58);
        this.overlayLayer.addChild(titleText);

        const statusText = new Text({
            text: `${this.level.name.toUpperCase()}  ${this.kills}/${this.level.targetKills} KILLS  ${Math.round(this.player.body.x)}/${this.level.levelLength}M`,
            style: new TextStyle({ fill: 0x91e5ff, fontSize: 15, fontWeight: 'bold', wordWrap: true, wordWrapWidth: panelW - 56 }),
        });
        statusText.anchor.set(0.5);
        statusText.position.set(window.innerWidth / 2, panelY + 104);
        this.overlayLayer.addChild(statusText);

        this.addPauseButton(panelX + 70, panelY + 138, panelW - 140, 44, 'RESUME', 0x44ff88, () => this.resumeGame());
        this.addPauseButton(panelX + 70, panelY + 192, panelW - 140, 44, 'RETRY LEVEL', 0xffd166, () => this.restartLevel());
        this.addPauseButton(panelX + 70, panelY + 246, panelW - 140, 44, 'MAIN MENU', 0x67e8f9, () => this.engine.scenes.loadScene(MenuScene));
    }

    private addPauseButton(x: number, y: number, w: number, h: number, label: string, color: number, onClick: () => void): void {
        const button = new Container();
        button.addChild(this.drawOverlayButtonChrome(w, h, color));

        const text = new Text({ text: label, style: new TextStyle({ fill: 0x07110b, fontSize: 18, fontWeight: 'bold' }) });
        text.anchor.set(0.5);
        text.position.set(w / 2, h / 2);
        button.addChild(text);

        button.position.set(x, y);
        button.eventMode = 'static';
        button.cursor = 'pointer';
        button.on('pointerdown', onClick);
        this.overlayButtonRegistry.push({ label, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
        this.overlayLayer.addChild(button);
    }

    private drawOverlayButtonChrome(w: number, h: number, color: number): Graphics {
        const bg = new Graphics();
        bg.roundRect(3, 5, w, h, 9).fill({ color: 0x020617, alpha: 0.58 });
        bg.roundRect(0, 0, w, h, 9).fill(color).stroke({ color: 0xffffff, width: 2, alpha: 0.34 });
        bg.roundRect(5, 5, w - 10, Math.max(8, h * 0.34), 6).fill({ color: 0xffffff, alpha: 0.18 });
        bg.rect(8, h - 7, w - 16, 3).fill({ color: 0x07110b, alpha: 0.24 });
        bg.circle(13, h * 0.5, 3).fill({ color: 0x07110b, alpha: 0.26 });
        bg.circle(w - 13, h * 0.5, 3).fill({ color: 0x07110b, alpha: 0.26 });
        return bg;
    }

    private drawResultOverlay(title: string, subtitle: string, cta: string, extraLine: string = ''): void {
        this.overlayLayer.removeChildren();
        this.overlayButtonRegistry = [];
        const shade = new Graphics();
        shade.rect(0, 0, window.innerWidth, window.innerHeight).fill({ color: 0x05070b, alpha: 0.68 });
        this.overlayLayer.addChild(shade);

        const panelW = Math.min(520, window.innerWidth - 48);
        const panelH = extraLine ? 296 : 260;
        const panelX = (window.innerWidth - panelW) / 2;
        const panelY = Math.max(40, (window.innerHeight - panelH) / 2);
        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 12).fill(0x101822).stroke({ color: 0x67e8f9, width: 2 });
        this.overlayLayer.addChild(panel);

        const titleText = new Text({ text: title, style: new TextStyle({ fill: 0xffffff, fontSize: 42, fontWeight: 'bold' }) });
        titleText.anchor.set(0.5);
        titleText.position.set(window.innerWidth / 2, panelY + 62);
        this.overlayLayer.addChild(titleText);

        const subText = new Text({ text: subtitle, style: new TextStyle({ fill: 0x91e5ff, fontSize: 22, fontWeight: 'bold' }) });
        subText.anchor.set(0.5);
        subText.position.set(window.innerWidth / 2, panelY + 114);
        this.overlayLayer.addChild(subText);

        const rewardText = new Text({ text: `GEMS ${this.gems}`, style: new TextStyle({ fill: 0xffd166, fontSize: 24, fontWeight: 'bold' }) });
        rewardText.anchor.set(0.5);
        rewardText.position.set(window.innerWidth / 2, panelY + 158);
        this.overlayLayer.addChild(rewardText);

        if (extraLine) {
            const extraText = new Text({ text: extraLine, style: new TextStyle({ fill: 0xfca5a5, fontSize: 17, fontWeight: 'bold' }) });
            extraText.anchor.set(0.5);
            extraText.position.set(window.innerWidth / 2, panelY + 188);
            this.overlayLayer.addChild(extraText);
        }

        const buttonY = panelY + (extraLine ? 226 : 190);
        this.overlayLayer.removeAllListeners('pointerdown');
        this.addPauseButton(panelX + 70, buttonY, panelW - 140, 48, cta, 0x44ff88, () => {
            if (this.state === 'LEVEL_COMPLETE') this.goToNextLevel();
            if (this.state === 'DEAD') this.restartLevel();
        });
    }

    private drawDeadOverlay(): void {
        this.overlayLayer.removeChildren();
        this.overlayLayer.removeAllListeners('pointerdown');
        this.overlayButtonRegistry = [];
        const shade = new Graphics();
        shade.rect(0, 0, window.innerWidth, window.innerHeight).fill({ color: 0x05070b, alpha: 0.68 });
        this.overlayLayer.addChild(shade);

        const panelW = Math.min(540, window.innerWidth - 48);
        const panelH = this.canOfferRewardedContinue() ? 320 : 268;
        const panelX = (window.innerWidth - panelW) / 2;
        const panelY = Math.max(36, (window.innerHeight - panelH) / 2);
        const panel = new Graphics();
        panel.roundRect(panelX, panelY, panelW, panelH, 12).fill(0x101822).stroke({ color: 0xfca5a5, width: 2 });
        this.overlayLayer.addChild(panel);

        const titleText = new Text({ text: 'RUN ENDED', style: new TextStyle({ fill: 0xffffff, fontSize: 42, fontWeight: 'bold' }) });
        titleText.anchor.set(0.5);
        titleText.position.set(window.innerWidth / 2, panelY + 58);
        this.overlayLayer.addChild(titleText);

        const subText = new Text({ text: 'Continue once with a rewarded ad or retry the route', style: new TextStyle({ fill: 0x91e5ff, fontSize: 18, fontWeight: 'bold', wordWrap: true, wordWrapWidth: panelW - 60 }) });
        subText.anchor.set(0.5);
        subText.position.set(window.innerWidth / 2, panelY + 110);
        this.overlayLayer.addChild(subText);

        const rewardText = new Text({ text: `GEMS ${this.gems}`, style: new TextStyle({ fill: 0xffd166, fontSize: 24, fontWeight: 'bold' }) });
        rewardText.anchor.set(0.5);
        rewardText.position.set(window.innerWidth / 2, panelY + 154);
        this.overlayLayer.addChild(rewardText);

        let y = panelY + 188;
        if (this.canOfferRewardedContinue()) {
            this.addPauseButton(panelX + 70, y, panelW - 140, 46, 'WATCH AD: CONTINUE', 0xa879ff, () => this.requestRewardedContinue());
            y += 56;
        }
        this.addPauseButton(panelX + 70, y, panelW - 140, 46, 'RETRY LEVEL', 0x44ff88, () => this.restartLevel());
    }

    private canOfferRewardedContinue(): boolean {
        return this.adReady && !this.adContinueUsed && !this.isEndless;
    }

    private requestRewardedContinue(): void {
        if (!this.canOfferRewardedContinue()) return;
        const bridge = window.ReactNativeWebView;
        if (!bridge) {
            console.warn('Rewarded continue requested but ReactNativeWebView bridge is unavailable.');
            return;
        }
        this.adReady = false;
        bridge.postMessage(JSON.stringify({ type: 'showAd', rewardType: 'continue' }));
        this.drawDeadOverlay();
    }

    private applyRewardedContinue(): void {
        if (this.state !== 'DEAD' || this.adContinueUsed) return;
        this.adContinueUsed = true;
        this.player.clearHitState();
        this.player.hp = Math.max(55, this.player.hp);
        const respawnX = Math.min(this.level.levelLength - this.player.body.w - 80, Math.max(80, this.lastSafeX));
        this.player.body.x = respawnX;
        this.player.body.y = this.groundY - this.player.body.h - 2;
        this.player.body.vx = 240;
        this.player.body.vy = 0;
        this.player.body.onGround = true;
        this.player.body.groundedOn = 'ground';
        this.projectiles.forEach((projectile) => {
            this.stage.removeChild(projectile.view);
            this.engine.physics.removeBody(projectile.body);
        });
        this.projectiles = [];
        this.playerProjectiles.forEach((projectile) => {
            this.stage.removeChild(projectile.view);
            this.engine.physics.removeBody(projectile.body);
        });
        this.playerProjectiles = [];
        this.bombExplosions.forEach((explosion) => this.stage.removeChild(explosion.view));
        this.bombExplosions = [];
        this.particles.clearAll();
        // Despawn enemies that would re-kill the player as soon as i-frames end.
        const safeRadius = 320;
        this.enemies = this.enemies.filter((enemy) => {
            const dx = enemy.body.x + enemy.body.w * 0.5 - (respawnX + this.player.body.w * 0.5);
            if (Math.abs(dx) > safeRadius) return true;
            this.stage.removeChild(enemy.view);
            this.engine.physics.removeBody(enemy.body);
            return false;
        });
        this.hitThisAttack.clear();
        this.player.grantInvincibility(1.5);
        this.state = 'PLAYING';
        this.publishNativeUiState();
        this.overlayLayer.removeChildren();
        this.overlayLayer.removeAllListeners('pointerdown');
        this.overlayButtonRegistry = [];
        SoundManager.playCue('clear');
        this.updateHUD();
    }

    private goToNextLevel(): void {
        GameScene.selectLevel(this.isEndless ? 0 : (this.level.id >= LEVELS.length ? 1 : this.level.id + 1));
        this.engine.scenes.loadScene(GameScene);
    }

    private restartLevel(): void {
        GameScene.selectLevel(this.level.id);
        this.engine.scenes.loadScene(GameScene);
    }

    private updateHUD(): void {
        this.hud.updateStats(this.player.hp, 100, this.gems, this.level.id, this.kills, this.level.targetKills);
    }

    private publishNativeUiState(controlsVisible: boolean = this.state === 'PLAYING'): void {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'gameUiState',
            phase: this.state,
            controlsVisible,
        }));
    }

    public render(alpha: number): void {
        this.player.render();
        for (const enemy of this.enemies) enemy.render();
        for (const p of this.projectiles) p.view.position.set(p.body.x, p.body.y);
        for (const p of this.playerProjectiles) p.view.position.set(p.body.x, p.body.y);
    }

    public destroy(): void {
        window.removeEventListener('resize', this.resizeHandler);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('message', this.messageHandler);
        document.removeEventListener('message', this.messageHandler as EventListener);
        this.engine.app.stage.removeChild(this.stage);
        this.engine.app.stage.removeChild(this.uiLayer);
        this.engine.physics.removeBody(this.player.body);
        for (const enemy of this.enemies) this.engine.physics.removeBody(enemy.body);
        for (const p of this.projectiles) this.engine.physics.removeBody(p.body);
        for (const p of this.playerProjectiles) this.engine.physics.removeBody(p.body);
        this.engine.physics.clearPlatforms();
        this.engine.physics.clearGroundGaps();
        this.stage.destroy({ children: true });
        this.uiLayer.destroy({ children: true });
    }

    public getSnapshot(): unknown {
        return {
            phase: this.state,
            level: this.level.id,
            level_name: this.level.name,
            biome: this.level.biome,
            endless: this.isEndless,
            endless_depth: this.endlessDepth,
            difficultyMultiplier: this.difficultyMultiplier,
            kills: this.kills,
            target_kills: this.level.targetKills,
            gems: this.gems,
            player: {
                x: Math.round(this.player.body.x),
                screenX: Math.round(this.player.body.x - this.cameraX),
                y: Math.round(this.player.body.y),
                vx: Math.round(this.player.body.vx),
                vy: Math.round(this.player.body.vy),
                hp: this.player.hp,
                onGround: this.player.body.onGround,
                attacking: this.player.isAttacking,
                dashing: this.player.isDashing,
                crouching: this.player.isCrouching,
                pounding: this.player.isPounding,
                facingRight: this.player.facingRight,
                groundedOn: this.player.body.groundedOn,
                dropThroughTimer: Number(this.player.body.dropThroughTimer.toFixed(3)),
                attackId: this.player.attackId,
                attackMode: this.player.attackMode,
                attackPhase: this.player.attackPhase,
                animation_state: this.player.animationState,
                runningAttackBlend: this.player.runningAttackBlend,
                attackRange: this.player.attackRange,
                meleeDamage: this.player.meleeDamage,
                rangedDamage: this.player.rangedDamage,
                rangedProjectileSpeed: this.player.rangedProjectileSpeed,
                slashVisible: this.player.isSlashVisible(),
                rangedPoseVisible: this.player.isRangedPoseVisible(),
                rangedShotsFired: this.player.rangedShotsFired,
                rangedCooldownReady: this.player.rangedCooldownReady(),
                rangedCooldownRemaining: Number(this.player.rangedCooldownRemaining.toFixed(2)),
            },
            weapons: {
                equipped_melee: this.meleeWeapon.id,
                equipped_ranged: this.rangedWeapon.id,
                melee_name: this.meleeWeapon.name,
                ranged_name: this.rangedWeapon.name,
                last_unlocks: this.lastWeaponUnlocks.map((weapon) => weapon.id),
                melee_upgrade: getWeaponUpgradeSnapshot('melee'),
                ranged_upgrade: getWeaponUpgradeSnapshot('ranged'),
            },
            ads: {
                ready: this.adReady,
                rewarded_continue_used: this.adContinueUsed,
                continue_offer: this.state === 'DEAD' && this.canOfferRewardedContinue(),
            },
            overlay_buttons: this.overlayButtonRegistry,
            camera: { x: Math.round(this.cameraX) },
            pacing: {
                run_up_distance: this.level.runUpDistance,
                next_spawn_x: Math.round(this.nextSpawnX),
                level_length: this.level.levelLength,
            },
            variety: {
                terrain_profile: this.level.terrainProfile,
                spawn_pattern: this.level.spawnPattern,
                enemy_kinds: this.level.enemyKinds,
                level_modifiers: this.level.levelModifiers,
            },
            progress: {
                distance: Math.round(this.player.body.x),
                distance_pct: Number(Math.min(1, this.player.body.x / Math.max(1, this.level.levelLength)).toFixed(3)),
                goal_met: this.hasMetLevelGoal(),
            },
            terrain: this.terrainPlatforms.map((platform) => ({
                x: Math.round(platform.x),
                screenX: Math.round(platform.x - this.cameraX),
                y: Math.round(platform.y),
                w: Math.round(platform.w),
                h: Math.round(platform.h),
            })),
            gaps: this.terrainGaps.map((gap) => ({
                x: Math.round(gap.x),
                screenX: Math.round(gap.x - this.cameraX),
                w: Math.round(gap.w),
                depth: Math.round(gap.depth),
            })),
            hazards: this.hazards.map((hazard) => ({
                type: hazard.type,
                x: Math.round(hazard.x),
                screenX: Math.round(hazard.x - this.cameraX),
                y: Math.round(hazard.y),
                w: Math.round(hazard.w),
                h: Math.round(hazard.h),
                active: hazard.active,
                damage: hazard.damage,
            })),
            enemies: this.enemies.map((enemy) => ({
                type: enemy.type,
                x: Math.round(enemy.body.x),
                screenX: Math.round(enemy.body.x - this.cameraX),
                y: Math.round(enemy.body.y),
                vx: Math.round(enemy.body.vx),
                hp: enemy.hp,
                dead: enemy.isDead,
                attacking: enemy.isAttacking,
                animation_state: enemy.sprite.animationState,
                animation_frame: enemy.sprite.animationFrame,
                mechanic: enemy.mechanic,
                enemy_gap_aware: this.isEnemyNearGroundGap(enemy),
                gapAction: this.gapAction(enemy),
            })),
            player_projectiles: this.playerProjectiles.map((projectile) => ({
                x: Math.round(projectile.body.x),
                screenX: Math.round(projectile.body.x - this.cameraX),
                y: Math.round(projectile.body.y),
                vx: Math.round(projectile.body.vx),
            })),
            bomb_explosions: this.bombExplosions.map((explosion) => ({
                x: Math.round(explosion.x),
                screenX: Math.round(explosion.x - this.cameraX),
                y: Math.round(explosion.y),
                radius: Math.round(explosion.radius),
                life: Number(explosion.life.toFixed(2)),
            })),
            projectiles: this.projectiles.length,
        };
    }
}
