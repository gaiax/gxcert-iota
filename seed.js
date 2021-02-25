const cryptico = require("cryptico");

const SEED_CHARS = "9ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function getSeed(uid) {
  let seed = "";
  Math.seedrandom(uid);
  for (let i = 0; i < 81; i++) {
    const index = Math.floor(Math.random() * SEED_CHARS.length);
    seed += SEED_CHARS[index];
  }
  Math.seedrandom();
  return seed;
}

module.exports = {
  getSeed,
}
