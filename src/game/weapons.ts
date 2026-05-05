import { readString, readStringList, writeString, writeStringList } from './storage';

export type WeaponSlot = 'melee' | 'ranged';

export interface WeaponDefinition {
    id: string;
    slot: WeaponSlot;
    name: string;
    unlockLevel: number;
    damage: number;
    range: number;
    cooldown: number;
    projectileSpeed: number;
    description: string;
}

export const MELEE_WEAPONS: WeaponDefinition[] = [
    { id: 'stone_blade', slot: 'melee', name: 'Stone Blade', unlockLevel: 1, damage: 28, range: 145, cooldown: 0.4, projectileSpeed: 0, description: 'Balanced starter slash' },
    { id: 'iron_cleaver', slot: 'melee', name: 'Iron Cleaver', unlockLevel: 2, damage: 36, range: 124, cooldown: 0.44, projectileSpeed: 0, description: 'Harder hits, shorter reach' },
    { id: 'storm_spear', slot: 'melee', name: 'Storm Spear', unlockLevel: 5, damage: 30, range: 184, cooldown: 0.38, projectileSpeed: 0, description: 'Long reach for safer running attacks' },
    { id: 'sky_maul', slot: 'melee', name: 'Sky Maul', unlockLevel: 8, damage: 48, range: 132, cooldown: 0.52, projectileSpeed: 0, description: 'Heavy armor breaker' },
];

export const RANGED_WEAPONS: WeaponDefinition[] = [
    { id: 'pebble_sling', slot: 'ranged', name: 'Pebble Sling', unlockLevel: 1, damage: 22, range: 0, cooldown: 0.85, projectileSpeed: 680, description: 'Reliable starter shot' },
    { id: 'spark_bow', slot: 'ranged', name: 'Spark Bow', unlockLevel: 3, damage: 18, range: 0, cooldown: 0.56, projectileSpeed: 760, description: 'Fast follow-up shots' },
    { id: 'ember_lobber', slot: 'ranged', name: 'Ember Lobber', unlockLevel: 6, damage: 34, range: 0, cooldown: 1.08, projectileSpeed: 610, description: 'Slower, punchier projectile' },
    { id: 'star_javelin', slot: 'ranged', name: 'Star Javelin', unlockLevel: 9, damage: 30, range: 0, cooldown: 0.72, projectileSpeed: 860, description: 'Premium speed and damage' },
];

const OWNED_MELEE_KEY = 'gronk_owned_melee_weapons';
const OWNED_RANGED_KEY = 'gronk_owned_ranged_weapons';
const EQUIPPED_MELEE_KEY = 'gronk_equipped_melee_weapon';
const EQUIPPED_RANGED_KEY = 'gronk_equipped_ranged_weapon';

export interface WeaponInventorySnapshot {
    melee: WeaponDefinition[];
    ranged: WeaponDefinition[];
    ownedMelee: string[];
    ownedRanged: string[];
    equippedMelee: string;
    equippedRanged: string;
}

function roster(slot: WeaponSlot): WeaponDefinition[] {
    return slot === 'melee' ? MELEE_WEAPONS : RANGED_WEAPONS;
}

function ownedKey(slot: WeaponSlot): string {
    return slot === 'melee' ? OWNED_MELEE_KEY : OWNED_RANGED_KEY;
}

function equippedKey(slot: WeaponSlot): string {
    return slot === 'melee' ? EQUIPPED_MELEE_KEY : EQUIPPED_RANGED_KEY;
}

function starter(slot: WeaponSlot): WeaponDefinition {
    return roster(slot)[0];
}

export function getOwnedWeaponIds(slot: WeaponSlot): string[] {
    const ids = readStringList(ownedKey(slot), [starter(slot).id]);
    return [...new Set([starter(slot).id, ...ids])].filter((id) => roster(slot).some((weapon) => weapon.id === id));
}

export function getEquippedWeapon(slot: WeaponSlot): WeaponDefinition {
    const owned = getOwnedWeaponIds(slot);
    const saved = readString(equippedKey(slot), starter(slot).id);
    const id = owned.includes(saved) ? saved : starter(slot).id;
    return roster(slot).find((weapon) => weapon.id === id) || starter(slot);
}

export function equipWeapon(id: string): boolean {
    const weapon = [...MELEE_WEAPONS, ...RANGED_WEAPONS].find((candidate) => candidate.id === id);
    if (!weapon) return false;
    if (!getOwnedWeaponIds(weapon.slot).includes(id)) return false;
    writeString(equippedKey(weapon.slot), id);
    return true;
}

export function grantWeaponsForLevel(level: number): WeaponDefinition[] {
    const granted: WeaponDefinition[] = [];
    for (const slot of ['melee', 'ranged'] as WeaponSlot[]) {
        const owned = new Set(getOwnedWeaponIds(slot));
        for (const weapon of roster(slot)) {
            if (weapon.unlockLevel > Math.max(1, level)) continue;
            if (owned.has(weapon.id)) continue;
            owned.add(weapon.id);
            granted.push(weapon);
        }
        writeStringList(ownedKey(slot), [...owned]);
    }
    return granted;
}

export function getWeaponInventorySnapshot(): WeaponInventorySnapshot {
    return {
        melee: MELEE_WEAPONS,
        ranged: RANGED_WEAPONS,
        ownedMelee: getOwnedWeaponIds('melee'),
        ownedRanged: getOwnedWeaponIds('ranged'),
        equippedMelee: getEquippedWeapon('melee').id,
        equippedRanged: getEquippedWeapon('ranged').id,
    };
}
