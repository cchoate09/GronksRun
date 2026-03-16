const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, TableOfContents,
} = require('docx');

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const headerShading = { fill: '1B3A5C', type: ShadingType.CLEAR };
const altShading = { fill: 'F0F4F8', type: ShadingType.CLEAR };
const COL_FULL = 9360;

function hdr(text) {
  return new TableCell({
    borders, shading: headerShading, margins: cellMargins,
    width: { size: 1, type: WidthType.DXA },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', font: 'Arial', size: 20 })] })],
  });
}

function cell(text, shade) {
  const opts = { borders, margins: cellMargins, width: { size: 1, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text, font: 'Arial', size: 20 })] })] };
  if (shade) opts.shading = altShading;
  return new TableCell(opts);
}

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text, font: 'Arial' })] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 }, children: [new TextRun({ text, font: 'Arial' })] }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 }, children: [new TextRun({ text, font: 'Arial' })] }); }
function p(text) { return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, font: 'Arial', size: 22 })] }); }
function bold(label, text) { return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 22 }), new TextRun({ text, font: 'Arial', size: 22 })] }); }
function bullet(text, ref = 'bullets') { return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, font: 'Arial', size: 22 })] }); }
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

// Character table
const charCols = [1560, 1560, 1560, 1560, 1560, 1560];
const charHeaders = ['Character', 'HP', 'Speed', 'Hit Size', 'Special', 'Scale'];
const chars = [
  ['Gronk', '100', '1.0x', '1.0x', 'Balanced', '1.0'],
  ['Pip', '70', '1.05x', '0.72x', 'High jumper', '0.75'],
  ['Bruk', '150', '0.93x', '1.25x', 'Start shield', '1.2'],
  ['Zara', '80', '1.12x', '0.88x', 'Start +5 gems', '1.0'],
  ['Rex', '60', '1.2x', '0.65x', 'Fastest', '0.7'],
  ['Mog', '90', '0.97x', '1.0x', 'Start magnet', '1.05'],
];

const charTable = new Table({
  width: { size: COL_FULL, type: WidthType.DXA },
  columnWidths: charCols,
  rows: [
    new TableRow({ children: charHeaders.map(h => hdr(h)) }),
    ...chars.map((row, i) => new TableRow({ children: row.map(c => cell(c, i % 2 === 1)) })),
  ],
});

// Level table
const lvlCols = [800, 2200, 1200, 1200, 3960];
const lvlHeaders = ['Level', 'Name', 'Theme', 'Time', 'Enemies'];
const levels = [
  ['1', 'Jungle Ruins', 'JUNGLE', '45s', 'Troll, Serpent'],
  ['2', 'Volcanic Caves', 'VOLCANO', '55s', 'Troll, Charger, Golem'],
  ['3', 'Glacier Peaks', 'GLACIER', '65s', 'Charger, Diver, Bomber'],
  ['4', 'Murky Swamp', 'SWAMP', '75s', 'Troll, Witch, Serpent, Golem'],
  ['5', 'Sky Sanctuary', 'SKY', '85s', 'Diver, Witch, Charger, Bomber'],
];

const lvlTable = new Table({
  width: { size: COL_FULL, type: WidthType.DXA },
  columnWidths: lvlCols,
  rows: [
    new TableRow({ children: lvlHeaders.map(h => hdr(h)) }),
    ...levels.map((row, i) => new TableRow({ children: row.map(c => cell(c, i % 2 === 1)) })),
  ],
});

// Enemy table
const eCols = [1400, 1200, 6760];
const eHeaders = ['Enemy', 'Damage', 'Behavior'];
const enemies = [
  ['Troll', '20', 'Ground-based, fires rocks with gravity arc'],
  ['Charger', '40', 'Warns then charges across screen, kicks debris'],
  ['Diver', '25', 'Flies overhead, shoots aimed feather darts'],
  ['Witch', '15', 'Floats mid-air, fires homing skull projectiles'],
  ['Golem', '30', 'Heavy stone creature, shockwaves and boulder tosses'],
  ['Bomber', '10', 'Aerial, drops bombs from above'],
  ['Serpent', '20', 'Ground slither, spits venom with gravity'],
];

const enemyTable = new Table({
  width: { size: COL_FULL, type: WidthType.DXA },
  columnWidths: eCols,
  rows: [
    new TableRow({ children: eHeaders.map(h => hdr(h)) }),
    ...enemies.map((row, i) => new TableRow({ children: row.map(c => cell(c, i % 2 === 1)) })),
  ],
});

// Obstacle table
const oCols = [1800, 1200, 6360];
const oHeaders = ['Obstacle', 'Damage', 'Description'];
const obstacles = [
  ['Rock', '15', 'Theme-colored irregular stone with highlights'],
  ['Spike', '25', 'Cluster of 3 pointed spikes with glow effect'],
  ['Log', '10', 'Wooden log with grain texture details'],
  ['Boulder', '35', 'Rolling stone with cracks, dust particles'],
  ['Fire Geyser', '30', 'Animated eruption with flame particles'],
  ['Pterodactyl', '20', 'Flying creature with animated wing flaps'],
];

const obsTable = new Table({
  width: { size: COL_FULL, type: WidthType.DXA },
  columnWidths: oCols,
  rows: [
    new TableRow({ children: oHeaders.map(h => hdr(h)) }),
    ...obstacles.map((row, i) => new TableRow({ children: row.map(c => cell(c, i % 2 === 1)) })),
  ],
});

// Boss table
const bCols = [800, 2000, 1000, 5560];
const bHeaders = ['Level', 'Boss', 'HP', 'Attacks'];
const bosses = [
  ['5', 'Jungle Troll King', '100', 'Rock clusters, ground pounds'],
  ['10', 'Volcano Golem', '150', 'Boulder rain, fire beam'],
  ['15', 'Ice Dragon', '120', 'Ice shards, ice pillars'],
  ['20', 'Swamp Witch Queen', '100', 'Homing skulls, poison cloud'],
  ['25', 'Sky Phoenix', '130', 'Swoops, feather storms'],
];

const bossTable = new Table({
  width: { size: COL_FULL, type: WidthType.DXA },
  columnWidths: bCols,
  rows: [
    new TableRow({ children: bHeaders.map(h => hdr(h)) }),
    ...bosses.map((row, i) => new TableRow({ children: row.map(c => cell(c, i % 2 === 1)) })),
  ],
});

// Milestone table
const mCols = [1500, 2000, 2000, 3860];
const mHeaders = ['Gems', 'Reward', 'Repeats', 'Effect'];
const milestones = [
  ['5', 'Shield', 'Every 25', 'Blocks one hit, 15 iframes after'],
  ['15', 'Gem Magnet', 'One-time', 'Pulls gems from 10 UNIT radius'],
  ['30', 'Extra Life', 'Every 35', 'Restores 30% HP on lethal damage'],
  ['50', 'Star Power', 'Every 50', '10 seconds of invincibility'],
];

const milestoneTable = new Table({
  width: { size: COL_FULL, type: WidthType.DXA },
  columnWidths: mCols,
  rows: [
    new TableRow({ children: mHeaders.map(h => hdr(h)) }),
    ...milestones.map((row, i) => new TableRow({ children: row.map(c => cell(c, i % 2 === 1)) })),
  ],
});

// Achievement table
const aCols = [2200, 4000, 3160];
const aHeaders = ['Achievement', 'Requirement', 'Category'];
const achievements = [
  ['First Steps', 'Complete first run', 'Progression'],
  ['Gem Hunter', 'Collect 100 total gems', 'Collection'],
  ['Gem Master', 'Collect 500 total gems', 'Collection'],
  ['Adventurer', 'Reach level 5', 'Progression'],
  ['Explorer', 'Reach level 10', 'Progression'],
  ['High Scorer', '10,000 total score', 'Score'],
  ['Score Legend', '50,000 total score', 'Score'],
  ['Smasher', 'Destroy 50 obstacles', 'Combat'],
  ['Speed Demon', 'Use dash 100 times', 'Mechanics'],
  ['Loyal Player', '5-day login streak', 'Engagement'],
];

const achTable = new Table({
  width: { size: COL_FULL, type: WidthType.DXA },
  columnWidths: aCols,
  rows: [
    new TableRow({ children: aHeaders.map(h => hdr(h)) }),
    ...achievements.map((row, i) => new TableRow({ children: row.map(c => cell(c, i % 2 === 1)) })),
  ],
});

// Sound table
const sCols = [1800, 1800, 5760];
const sHeaders = ['Sound', 'Waveform', 'Details'];
const sounds = [
  ['Jump', 'Sine 200-600 Hz', '0.12s sweep upward'],
  ['Land', 'Sine 80 Hz', '0.06s thud'],
  ['Gem', 'Sine 880-1200 Hz', '0.18s chime'],
  ['Hit', 'Sawtooth 100 Hz', '0.2s impact'],
  ['Death', 'Sawtooth 400-80 Hz', '0.55s descending'],
  ['Dash', 'White noise', '0.15s whoosh'],
  ['Slide', 'Noise LP 400 Hz', '0.3s scrape'],
  ['Shield', 'Triangle 600 Hz', '0.3s ping'],
  ['Level Complete', 'C-E-G-C chord', 'Major chord arpeggio'],
  ['Spin', 'Square 2000 Hz', '0.03s tick'],
];

const soundTable = new Table({
  width: { size: COL_FULL, type: WidthType.DXA },
  columnWidths: sCols,
  rows: [
    new TableRow({ children: sHeaders.map(h => hdr(h)) }),
    ...sounds.map((row, i) => new TableRow({ children: row.map(c => cell(c, i % 2 === 1)) })),
  ],
});

// Wheel table
const wCols = [2400, 6960];
const wHeaders = ['Reward', 'Effect'];
const wheels = [
  ['Shield', 'Blocks one incoming hit'],
  ['Speed Boost', 'Increased movement speed'],
  ['Magnet', 'Auto-collect nearby gems'],
  ['Extra Life', 'Survive one lethal hit'],
  ['Star Power', 'Temporary invincibility'],
  ['+10s Time', 'Adds 10 seconds to timer'],
  ['Double Score', 'Score multiplier x2'],
  ['Tiny Hitbox', 'Reduced collision area'],
];

const wheelTable = new Table({
  width: { size: COL_FULL, type: WidthType.DXA },
  columnWidths: wCols,
  rows: [
    new TableRow({ children: wHeaders.map(h => hdr(h)) }),
    ...wheels.map((row, i) => new TableRow({ children: row.map(c => cell(c, i % 2 === 1)) })),
  ],
});

// Build document
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: '1B3A5C' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: '2E5D8A' },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: '3D7AB5' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [
    // COVER PAGE
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({ spacing: { before: 3600 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "GRONK'S RUN", font: 'Arial', size: 72, bold: true, color: '1B3A5C' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Game Design Document', font: 'Arial', size: 32, color: '5A5A5A' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Version 1.0', font: 'Arial', size: 24, color: '888888' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'March 2026', font: 'Arial', size: 24, color: '888888' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'HTML5 Canvas Mobile Runner', font: 'Arial', size: 24, color: '888888' })] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: '1B3A5C', space: 12 } },
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: 'Platform: Android (Expo/WebView) | Engine: Vanilla JS Canvas 2D', font: 'Arial', size: 20, color: '666666' })],
        }),
        pageBreak(),

        // TABLE OF CONTENTS
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Table of Contents', font: 'Arial' })] }),
        new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
        pageBreak(),

        // 1. OVERVIEW
        h1('1. Game Overview'),
        bold('Title: ', "Gronk's Run"),
        bold('Genre: ', 'Endless runner / platformer with RPG progression'),
        bold('Platform: ', 'Android (APK via Expo + WebView), also playable in mobile browser'),
        bold('Engine: ', 'HTML5 Canvas 2D, vanilla JavaScript (single-file architecture)'),
        bold('Target Audience: ', 'Casual mobile gamers, ages 8+'),
        p("Gronk's Run is a side-scrolling endless runner where players guide one of six unique characters through procedurally generated levels across five distinct themed worlds. The game features a deep progression system with 40 levels, boss fights every 5 levels, a gem milestone upgrade system, daily login rewards, achievements, and a reward wheel. Players use swipe-based touch controls to jump, slide, ground pound, and dash through increasingly challenging terrain filled with obstacles, enemies, and collectibles."),

        // 2. CHARACTERS
        pageBreak(),
        h1('2. Playable Characters'),
        p('Six characters with distinct stat profiles allow different playstyles. Each character has unique jump physics, speed, hitbox size, HP pool, and a special starting ability.'),
        charTable,
        new Paragraph({ spacing: { before: 200 } }),
        h3('2.1 Character Stats Explained'),
        bullet('HP: Total hit points before death. Ranges from 60 (Rex) to 150 (Bruk).'),
        bullet('Speed: Movement speed multiplier. Higher means faster scrolling and more reaction time required.'),
        bullet('Hit Size: Hitbox multiplier. Smaller values mean a more forgiving collision area.'),
        bullet('Scale: Visual size multiplier for the character sprite.'),
        bullet('Each character has independent jump velocity (jumpV) and double-jump velocity (jumpV2) tuned to their weight class.'),

        // 3. LEVELS
        pageBreak(),
        h1('3. Level Design'),
        h2('3.1 Level Structure'),
        p('The game contains 40 levels organized into 5 themed worlds that cycle with increasing difficulty. Each world has a unique color palette, ambient particle effects, and enemy roster.'),
        lvlTable,
        new Paragraph({ spacing: { before: 200 } }),
        h3('3.2 Level Cycling'),
        p('Levels 6-40 cycle through the five themes. The difficulty multiplier increases by 0.2 per level: Level 6 runs at 2.0x, Level 10 at 2.8x, etc. This creates a smooth difficulty ramp while reusing themed content.'),
        h3('3.3 Terrain Generation'),
        p('Terrain is procedurally generated using a seeded Park-Miller LCG random number generator. The world is divided into chunks, each with a terrain type:'),
        bullet('FLAT: Level ground with minor noise'),
        bullet('HILLS: Smooth sinusoidal elevation changes'),
        bullet('VALLEY: Downward dip following a sine curve'),
        bullet('RIDGE: Upward rise following an inverted sine curve'),
        bullet('GAP: Missing ground section requiring a jump'),
        bullet('GEM_RUN: Gem-rich flat section (used at level start)'),
        bullet('GAUNTLET: Dense obstacle section with 3-6 spawn slots'),
        p('Chunk selection is weighted by difficulty progress. Harder sections (GAUNTLET, GAP) become more frequent as the level progresses.'),

        // 4. PLAYER MECHANICS
        pageBreak(),
        h1('4. Player Mechanics'),
        h2('4.1 Jump System'),
        bullet('Double jump: Two jumps total before needing to land'),
        bullet('Jump buffering: 7-frame input window before landing'),
        bullet('Coyote frames: 7 frames of grace after walking off an edge'),
        bullet('Variable height: Holding the jump input results in higher jumps'),
        h2('4.2 Slide'),
        bullet('Duration: 0.6 seconds active, 1.5 second cooldown'),
        bullet('Hitbox shrinks to 28% of normal height'),
        bullet('Generates dust particles during slide'),
        bullet('Activated by swiping down while on the ground'),
        h2('4.3 Ground Pound'),
        bullet('Activated by swiping down while airborne'),
        bullet('Forces player downward at 900 velocity'),
        bullet('Creates 16-particle shockwave on landing with screen shake'),
        bullet('Destroys nearby obstacles (Rock, Spike, Log) within 3 UNIT range'),
        bullet('Awards +25 score per obstacle destroyed'),
        h2('4.4 Dash'),
        bullet('Duration: 0.7 seconds active, 1.8 second cooldown'),
        bullet('Grants 0.75 seconds of invincibility frames'),
        bullet('Doubles speed multiplier during dash'),
        bullet('Destroys nearby enemy projectiles'),
        bullet('Creates blue afterimage trail particles'),
        bullet('Activated by swiping right'),
        h2('4.5 Input System'),
        h3('Touch Controls'),
        bullet('Swipe Up: Jump (swipe again for double jump)'),
        bullet('Swipe Down: Slide (ground) or Ground Pound (airborne)'),
        bullet('Swipe Right: Dash'),
        bullet('Tap: Jump (fallback)'),
        h3('Keyboard Controls'),
        bullet('Space / Up / W: Jump'),
        bullet('Down / S: Slide or Ground Pound'),
        bullet('Shift: Dash'),

        // 5. ENEMIES
        pageBreak(),
        h1('5. Enemies'),
        h2('5.1 Enemy Types'),
        enemyTable,
        new Paragraph({ spacing: { before: 200 } }),
        h2('5.2 Projectile Types'),
        bullet('ROCK_P (15 dmg): Gravity-affected arc from Trolls'),
        bullet('SKULL (20 dmg): Homing projectile from Witches'),
        bullet('SHOCKWAVE (25 dmg): Ground-level wave from Golems'),
        bullet('BOMB (35 dmg): Dropped from above by Bombers'),
        bullet('VENOM (20 dmg): Gravity arc spit from Serpents'),
        bullet('FEATHER (10 dmg): Aimed darts from Divers'),
        bullet('DEBRIS (12 dmg): Kicked fragments from Chargers'),
        bullet('BOULDER_P (30 dmg): Thrown boulders from Golems'),
        h2('5.3 Enemy Spawn System'),
        p('Enemies spawn on a cooldown timer that decreases with difficulty progress: max(4, 9 - progress * 4) seconds. Enemy types are selected from the current level definition roster.'),

        // 6. OBSTACLES
        pageBreak(),
        h1('6. Obstacles'),
        obsTable,
        new Paragraph({ spacing: { before: 200 } }),
        p('Obstacles are placed procedurally within terrain chunks. Density scales from 1-3 per chunk (standard) to 3-6 per chunk (GAUNTLET). Boulders appear after 25% level progress; Pterodactyls after 40%.'),

        // 7. BOSS FIGHTS
        h1('7. Boss Fights'),
        p('Boss encounters occur every 5 levels. Each boss has unique attack patterns and visual design. The player has 15 seconds to defeat the boss. Ground pound deals 15 damage; dash deals 10 damage.'),
        bossTable,
        new Paragraph({ spacing: { before: 200 } }),
        p('After Level 25, boss types cycle with increased HP scaling.'),

        // 8. PROGRESSION
        pageBreak(),
        h1('8. Progression Systems'),
        h2('8.1 Gem Milestone Upgrades'),
        p('Gems collected during a run trigger repeating milestone rewards:'),
        milestoneTable,
        new Paragraph({ spacing: { before: 200 } }),
        p('Each gem also heals 5 HP and adds 5 seconds to the timer (max 99s).'),
        h2('8.2 Reward Wheel'),
        p('After completing a level, players spin an 8-segment wheel for a powerup that carries into the next level:'),
        wheelTable,
        new Paragraph({ spacing: { before: 200 } }),
        h2('8.3 Continue System'),
        bullet('2 continues per run'),
        bullet('Using a continue restarts the current level, keeping score and gems'),
        bullet('After all continues are exhausted, a 5-minute cooldown is imposed'),
        bullet('Cooldown is displayed on both the game over and level map screens'),
        bullet('Progress is saved at the highest level reached'),
        h2('8.4 Level Map'),
        p('A scrollable level map displays all 40 levels in a zigzag pattern. Nodes show completion state (gold checkmark), current level (pulsing glow), or locked status. Boss levels display larger with skull icons.'),

        // 9. COMBO
        pageBreak(),
        h1('9. Combo System'),
        p('The combo counter increases through continuous action and resets after 3 seconds of inactivity.'),
        h3('Combo Sources'),
        bullet('Gem collection: +50 base points'),
        bullet('Near-miss dodge: +25 points'),
        bullet('Dash destroying projectile: +15 points'),
        bullet('Ground pound smash: +25 points'),
        h3('Multiplier'),
        p('Combo multiplier tiers: 5 hits = 2x, 10 = 3x, 15 = 4x, 20 = 5x, 30 = 6x, 40 = 7x, 50+ = 8x. Visual indicator displays with color escalation (white, gold, orange, red, magenta, cyan, pink) and rainbow animation at 30+ combo.'),

        // 10. HP
        h1('10. Health System'),
        bullet('Max HP varies by character (60 to 150)'),
        bullet('Health bar uses green-yellow-red gradient'),
        bullet('Shield blocks one hit with 15 invincibility frames'),
        bullet('Extra life restores 50% HP on lethal damage'),
        bullet('Invincibility frames: 0.8s after damage, 2.5s on level start, 0.75s during dash'),
        bullet('Gems heal 5 HP each'),
        bullet('Fall damage: 999 (instant death)'),

        // 11. DIFFICULTY
        h1('11. Difficulty Scaling'),
        p('Difficulty scales from 0 to 1 based on time spent in the current level:'),
        bullet('Speed: lerp(200, 480, progress) multiplied by level and character modifiers'),
        bullet('Obstacle density: lerp(0.25, 0.65, progress)'),
        bullet('Gem frequency: lerp(0.40, 0.12, progress) - gems become rarer'),
        bullet('Gap frequency: lerp(0.06, 0.35, progress) - gaps become more common'),
        bullet('Level multiplier: 1 + (level - 1) * 0.2'),

        // 12. DAILY & ACHIEVEMENTS
        pageBreak(),
        h1('12. Daily Login Rewards'),
        p('Players receive a random reward on their first login each day. A consecutive day streak unlocks premium rewards (Star Power) at 3+ days. Available rewards include gem bonuses (+5, +10, +15 gems), shields, extra lives, speed boosts, magnets, and timer extensions.'),
        h1('13. Achievements'),
        achTable,

        // 14. AUDIO
        pageBreak(),
        h1('14. Audio System'),
        p('All sounds are procedurally generated using the Web Audio API with no external audio files required. A global mute toggle is accessible from all screens.'),
        soundTable,

        // 15. VISUAL
        pageBreak(),
        h1('15. Visual Systems'),
        h2('15.1 Theme Backgrounds'),
        bullet('JUNGLE: Dark greens, brown ground, gemstone hue 185'),
        bullet('VOLCANO: Red/orange sky, dark red ground, ambient embers'),
        bullet('GLACIER: Light blues, white sky, ambient snowfall'),
        bullet('SWAMP: Deep greens, dark ground, firefly ambience'),
        bullet('SKY: Bright blues, white highlights, clear atmosphere'),
        h2('15.2 Particle System'),
        p('Configurable particles with position, velocity, gravity, life decay, radius, and color. Effects include gem collection (12 colored), death (24 orange/red), landing dust, shield block (18 blue), ground pound shockwave (16 radial), and dash trail (blue afterimages).'),
        h2('15.3 Screen Shake'),
        p('Trauma-based system: trauma decays at 1.8/second. Screen offset = random * trauma squared * UNIT * 1.8. Triggered by player landing (0.08), shield hit (0.4), boss defeated (0.5), and other events.'),
        h2('15.4 Character Animation'),
        p('Characters use squash/stretch deformation on jump and land. Leg animation cycles when on ground. Eyes with pupils, blush marks, and character-specific features (Bruk has horns, Rex has a tail, etc.).'),

        // 16. UI
        h1('16. User Interface'),
        h2('16.1 Game Phases'),
        p('The game has 14 distinct phases: Menu, Daily Reward, Level Map, Character Select, Level Intro, Playing, Paused, Tutorial, Level Complete, Boss Fight, Dead, Continue Prompt, Spin Wheel, and Stats.'),
        h2('16.2 HUD Elements'),
        bullet('Score display (gold text with shadow)'),
        bullet('HP bar with gradient and numeric display'),
        bullet('Gem counter'),
        bullet('Timer countdown'),
        bullet('Combo indicator (bottom-left, rainbow at 20+)'),
        bullet('Pause button (top-right, offset for Android nav)'),
        bullet('Sound toggle (top-left speaker icon)'),
        h2('16.3 Tutorial'),
        p('Interactive how-to-play screen showing swipe gestures for jump, double jump, slide, stomp, and dash. Displayed on first launch; accessible from character select.'),

        // 17. TECHNICAL
        pageBreak(),
        h1('17. Technical Architecture'),
        h2('17.1 Single-File Design'),
        p('The entire game is contained in a single index.html file with embedded JavaScript and CSS. This simplifies deployment and allows the game to run in any WebView context.'),
        h2('17.2 Rendering'),
        bullet('HTML5 Canvas 2D context'),
        bullet('requestAnimationFrame game loop with try-catch error resilience'),
        bullet('Delta-time based updates for frame-rate independence'),
        bullet('AABB collision detection with forgiveness hitboxes'),
        h2('17.3 World System'),
        bullet('Chunk-based procedural generation with seeded RNG (Park-Miller LCG)'),
        bullet('Sample-based terrain interpolation at 55-pixel intervals'),
        bullet('Parallax background layers (8% and 25% scroll rates)'),
        h2('17.4 Save System'),
        bullet('LocalStorage with key "gronk2"'),
        bullet('Persists: highest level, best score, total gems, selected character'),
        bullet('Persists: save state, cooldown timer, login streak, tutorial flag'),
        bullet('Lifetime stats: total runs, gems, score, distances, action counts'),
        bullet('Achievement completion flags'),
        h2('17.5 Mobile Deployment'),
        bullet('Wrapped in Expo + React Native WebView for Android APK distribution'),
        bullet('PWA manifest for direct browser installation'),
        bullet('Touch-optimized with viewport-fit=cover'),
        bullet('EAS Build for APK generation'),
        h2('17.6 Save Data Schema'),
        p('Save data is stored in localStorage under key "gronk2" as JSON. On load, all numeric fields are coerced to Number type for migration safety.'),
        bullet('highestLevel (int): Highest level reached across all runs'),
        bullet('bestScore (int): All-time best score'),
        bullet('totalGems (int): Lifetime gem count'),
        bullet('selectedChar (int): Index 0-5 of chosen character'),
        bullet('savedLevel, savedScore, savedGems (int): Mid-run save state'),
        bullet('cooldownEnd (timestamp): When continue cooldown expires'),
        bullet('lastLoginDate (string YYYY-MM-DD): Local timezone date of last daily reward'),
        bullet('dailyStreak (int): Consecutive daily login count'),
        bullet('tutorialSeen (boolean): Whether how-to-play was shown'),
        bullet('stats (object): Lifetime counters for runs, gems, score, level, time, enemies, obstacles, dashes, slides'),
        bullet('achievements (object): Map of achievement ID to boolean completion flag'),

        // 18. DESIGN PHILOSOPHY
        pageBreak(),
        h1('18. Design Philosophy'),
        h2('18.1 Core Pillars'),
        bullet('Accessible Entry: Simple swipe controls that anyone can learn in seconds'),
        bullet('Depth Through Mastery: Combo system, near-misses, and ground pound rewards skilled play'),
        bullet('Progression Hooks: Daily rewards, milestone upgrades, achievements, and level map create long-term engagement'),
        bullet('Character Identity: Six distinct characters with meaningful stat tradeoffs encourage replay'),
        h2('18.2 Target Audience'),
        p('Primary: Casual mobile gamers ages 8-35 who enjoy short play sessions (2-5 minutes per run). Secondary: Completionists who want to unlock all 40 levels, earn all achievements, and maintain daily streaks.'),
        h2('18.3 Session Design'),
        p('Each level takes 30-90 seconds. A full run from Level 1 with 2 continues provides 3-10 minutes of gameplay. The continue cooldown (5 minutes) creates natural session breaks while the daily reward system incentivizes daily return visits.'),

        // 19. COLLISION SYSTEM
        h1('19. Collision System'),
        h2('19.1 AABB Detection'),
        p('All collision uses axis-aligned bounding box (AABB) intersection testing. The function aabb(a,b) checks if two rectangles {x, y, w, h} overlap.'),
        h2('19.2 Hitbox Specifications'),
        bullet('Player base: width = UNIT * 0.84, height = UNIT * 1.8 (modified by character hitM)'),
        bullet('Player sliding: height reduced to 28% of normal'),
        bullet('Player tiny (wheel powerup): hitbox scaled by 0.6x'),
        bullet('Near-miss zone: 0.4 UNIT padding on each side of obstacle hitbox'),
        bullet('Gem collection: 1.1 UNIT square centered on gem'),
        h2('19.3 Ground Detection'),
        p('Ground collision uses a speed-proportional tolerance: max(4, abs(vy) * dt * 1.2) pixels. This prevents pass-through on fast frames while keeping normal landing feel tight.'),

        // 20. INPUT SYSTEM DETAILS
        h1('20. Input System'),
        h2('20.1 Swipe Gesture Recognition'),
        bullet('Threshold: Dynamic, 3% of screen shorter dimension (clamped 20-50px)'),
        bullet('Max swipe time: 300ms from touchstart to recognition'),
        bullet('Direction: Primary axis (abs(dy) > abs(dx) for vertical, vice versa)'),
        bullet('Fallback: Taps under 300ms without swipe trigger a jump'),
        h2('20.2 Input Buffering'),
        bullet('Jump buffer: 7 frames — input accepted up to 7 frames before landing'),
        bullet('Coyote time: 7 frames — jump allowed after walking off an edge'),
        bullet('Down-input buffer: 5 frames — slide/ground pound input accepted over 5 frames'),
        bullet('Variable jump height: Releasing jump input caps upward velocity at -320'),
        h2('20.3 Auto-Pause'),
        p('The game auto-pauses when the browser tab loses visibility (visibilitychange event) or the window loses focus (blur event).'),

        // 21. PERFORMANCE
        h1('21. Performance Targets'),
        bullet('Target framerate: 60 FPS on mid-range Android devices (2020+)'),
        bullet('Particle cap: 200 maximum active particles with object pooling'),
        bullet('Font cache: Pre-computed font strings rebuilt on resize to avoid per-frame template literals'),
        bullet('Resize debounce: 150ms debounce on window resize and orientation change'),
        bullet('Delta-time clamped: DT capped at 100ms to prevent physics explosion on tab-switch'),
        bullet('Single-file architecture: ~3600 lines, zero external dependencies at runtime'),

        // 22. ACCESSIBILITY
        h1('22. Accessibility Considerations'),
        bullet('Portrait mode warning overlay with rotation prompt'),
        bullet('High-contrast color scheme with dark backgrounds and bright UI elements'),
        bullet('Haptic-style screen shake for impact feedback (visual only)'),
        bullet('Multiple input methods: touch swipe, tap fallback, and full keyboard support'),
        bullet('Sound can be fully muted via persistent toggle accessible from all screens'),
        bullet('Future considerations: colorblind mode, reduced motion option, font scaling'),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync('C:/Users/cchoa/Claude_Sandbox/gronk-run/Gronks_Run_GDD.docx', buffer);
  console.log('GDD created successfully!');
});
