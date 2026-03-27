const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');

// Fix analytics: level start
h = h.replace(
  "function startLevel(levelNum) {\n  G.phase='LEVEL_INTRO';",
  "function startLevel(levelNum) {\n  trackLevelStart(levelNum);\n  G.phase='LEVEL_INTRO';"
);

// Fix analytics: ad watched
h = h.replace(
  "function requestAd(rewardType) {\n  adPendingReward = rewardType;",
  "function requestAd(rewardType) {\n  trackAdWatched(rewardType);\n  adPendingReward = rewardType;"
);

fs.writeFileSync('index.html', h);
console.log('Fixed analytics: level start + ad watched');
