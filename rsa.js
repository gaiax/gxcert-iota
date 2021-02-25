const cryptico = require("cryptico");

function getKeyPair(uid) {
  Math.seedrandom(uid);
  const privKey = cryptico.generateRSAKey("", 1024);
  const pubKey = cryptico.publicKeyString(privKey);
  Math.seedrandom();
  return {
    privKey,
    pubKey,
  }
}

module.exports = {
  getKeyPair
}
