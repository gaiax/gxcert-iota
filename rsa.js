const cryptico = require("cryptico");

function getKeyPair(uid) {
  const privKey = cryptico.generateRSAKey(uid, 1024);
  const pubKey = cryptico.publicKeyString(privKey);
  return {
    privKey,
    pubKey,
  }
}

module.exports = {
  getKeyPair
}
