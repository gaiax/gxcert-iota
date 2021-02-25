const expect = require("expect");
const CertClient = require("./client");
const {randomBytes} = require('crypto')

function generateRandomString(length) {
  return randomBytes(length).reduce((p, i) => p + (i % 36).toString(36), '')
}

test("get first address by cert client", async() => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  await clientA.init();
  await clientB.init();
  const addressA = clientA.address;
  const addressB = clientB.address;
  const addressA2 = clientA.address;
  expect(addressA).toEqual(addressA2);
  expect(addressA).not.toEqual(addressB);
});

test("verify address", async() => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://nodes.devnet.iota.org", passphrase);
  await client.init();
  const verified = await client.verifyAddress(client.address);
  expect(verified).toEqual(true);
});
