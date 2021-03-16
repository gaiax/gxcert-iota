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
  const clientC = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  await clientA.init();
  await clientB.init();
  const addressA = clientA.address;
  const addressB = clientB.address;
  const addressC = clientA.address;
  expect(addressA).toEqual(addressC);
  expect(addressA).not.toEqual(addressB);
});

test("verify address", async() => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  await clientA.init();
  await clientB.init();
  const verified = await clientA.verifyAddress(clientA.address);
  expect(verified).toEqual(true);
  const notVerified = !(await clientA.verifyAddress(clientB.address));
  expect(notVerified).toEqual(true);
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
  expect(bundles.length).toEqual(2);
  expect(bundles[1].hello).toEqual("world");
});

test("is pubkey json", () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://nodes.devnet.iota.org", passphrase);
  let isPubKey = client.isPubKeyObject({
    pubkey: "helloworld"
  });
  expect(isPubKey).toEqual(true);
  isPubKey = client.isPubKeyObject({});
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
  expect(certificate.sig.length > 0).toEqual(true);
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
  expect(certificates[0].sig.length > 0).toEqual(true);
  expect(certificates[0].by).toEqual(clientA.address);
});

test("issue invalid certificate, and verify", async () => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  await clientA.init();
  await clientB.init();
  const ipfs = "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o";
  const certificate = clientB.createCertificateObject(ipfs);
  certificate.by = clientA.address;
  await clientA.issueCertificate(certificate, clientB.address);
  const certificates = await clientB.getCertificates(clientB.address);
  expect(certificates.length).toEqual(0);
});

test("register and get pubkey", async () => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  await clientA.init();
  await clientB.init();
  let pubkey = await clientA.getPubKeyOf(clientA.address);
  expect(pubkey).toEqual(clientA.rsaKeyPair.pubKey);
  const dummyPubKey = clientB.rsaKeyPair.pubKey;
  await clientB.sendTransaction({
    "pubkey": dummyPubKey
  }, clientA.address);
  pubkey = await clientA.getPubKeyOf(clientA.address);
  expect(pubkey).toEqual(clientA.rsaKeyPair.pubKey);
});

