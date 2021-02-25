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

test("sign and verify", async() => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  await clientA.init();
  await clientB.init();
  const signature = clientA.sign(clientB.rsaKeyPair.pubKey);
  let verified = clientB.verify(clientB.rsaKeyPair.pubKey, signature, clientA.rsaKeyPair.pubKey);
  expect(verified).toEqual(true);
  verified = clientB.verify("hello", signature, clientA.rsaKeyPair.pubKey);
  expect(verified).toEqual(false);
});

test("certificate text", () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://nodes.devnet.iota.org", passphrase);
  const text = client.certificateText("abcd", new Date());
  expect(text.endsWith("abcd") && text.length > 4).toEqual(true);
});

test("post and get bundle", async () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://nodes.devnet.iota.org", passphrase);
  await client.init();
  await client.sendTransaction({
    hello: "world"
  }, client.address);
  const bundles = await client.getBundles(client.address);
  expect(bundles.length).toEqual(1);
  expect(bundles[0].hello).toEqual("world");
});
