const expect = require("expect");
const { getKeyPair } = require("./rsa");

it("RSA key generation", () => {
  const keypair1 = getKeyPair("keypair");
  const keypair2 = getKeyPair("keypair2");
  const keypair3 = getKeyPair("keypair");
  expect(keypair1.pubKey).toEqual(keypair3.pubKey);
  expect(keypair1.pubKey).not.toEqual(keypair2.pubKey);
});
