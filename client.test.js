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

test("is pubkey json", () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://nodes.devnet.iota.org", passphrase);
  let isPubKey = client.isPubKeyObject({
    pubkey: "helloworld"
  });
  expect(isPubKey).toEqual(true);
  isPubKey = client.isPubKeyObject({
  });
  expect(isPubKey).toEqual(false);
});

test("is certificate json", () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://nodes.devnet.iota.org", passphrase);
  let isCert = client.isCertObject({
    ipfs: "A",
    time: (new Date()).getTime() / 1000,
    sig: "sig",
    by: "by",
  });
  expect(isCert).toEqual(true);
  isCert = client.isCertObject({
    time: (new Date()).getTime() / 1000,
    sig: "sig",
    by: "by",
  });
  expect(isCert).toEqual(false);
  isCert = client.isCertObject({
    ipfs: "A",
    sig: "sig",
    by: "by",
  });
  expect(isCert).toEqual(false);
  isCert = client.isCertObject({
    ipfs: "A",
    time: (new Date()).getTime() / 1000,
    by: "by",
  });
  expect(isCert).toEqual(false);
  isCert = client.isCertObject({
    ipfs: "A",
    time: (new Date()).getTime() / 1000,
    sig: "sig",
  });
  expect(isCert).toEqual(false);
});

test("create certificate object", () => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  const ipfs = "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o";
  const certificate = clientA.createCertificateObject(ipfs);
  expect(certificate.ipfs).toEqual(ipfs);
  expect(certificate.sig.length).toEqual(256);
});

test("issue certificate", async () => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  await clientA.init();
  await clientB.init();
  const ipfs = "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o";
  const certificate = clientA.createCertificateObject(ipfs);
  await clientA.issueCertificate(certificate, clientB.address);
  const certificates = await clientB.getCertificates(clientB.address);
  expect(certificates[0].ipfs).toEqual(ipfs);
  expect(certificates[0].time).not.toEqual(null);
  expect(certificates[0].time).not.toEqual(undefined);
  expect(certificates[0].sig.length).toEqual(256);
  expect(certificates[0].by).toEqual(clientA.address);
});

test("register and get pubkey", async () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://nodes.devnet.iota.org", passphrase);
  await client.init();
  await client.registerPubKey();
  const pubkey = await client.getPubKeyOf(client.address);
  expect(pubkey).toEqual(client.rsaKeyPair.pubKey);
});
