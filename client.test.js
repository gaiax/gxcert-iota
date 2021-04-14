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
  const text = client.certificateText("title", "description", "abcd", new Date(), client.address);
  expect(text.endsWith("title:description:abcd:" + client.address) && text.length > 4).toEqual(true);
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
    title: "title",
    description: "description",
  });
  expect(isCert).toEqual(true);
  isCert = client.isCertObject({
    time: (new Date()).getTime() / 1000,
    sig: "sig",
    by: "by",
    title: "title",
  });
  expect(isCert).toEqual(false);
  isCert = client.isCertObject({
    ipfs: "A",
    sig: "sig",
    by: "by",
    title: "title",
  });
  expect(isCert).toEqual(false);
  isCert = client.isCertObject({
    ipfs: "A",
    time: (new Date()).getTime() / 1000,
    by: "by",
    title: "title",
  });
  expect(isCert).toEqual(false);
  isCert = client.isCertObject({
    ipfs: "A",
    time: (new Date()).getTime() / 1000,
    sig: "sig",
    title: "title",
  });
  expect(isCert).toEqual(false);
  isCert = client.isCertObject({
    ipfs: "A",
    time: (new Date()).getTime() / 1000,
    sig: "sig",
    by: "by",
  });
  expect(isCert).toEqual(false);
  isCert = client.isCertObject({
    ipfs: "A",
    time: (new Date()).getTime() / 1000,
    sig: "sig",
    by: "by",
    title: "title",
  });
  expect(isCert).toEqual(false);
});

test("create certificate object", () => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  const ipfs = "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o";
  const title = "title";
  const description = "description";
  const certificate = clientA.createCertificateObject(title, description, ipfs, clientB.address);
  expect(certificate.ipfs).toEqual(ipfs);
  expect(certificate.title).toEqual(title);
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
  const title = "title";
  const description = "description";
  const certificate = clientA.createCertificateObject(title, description, ipfs, clientB.address);
  await clientA.issueCertificate(certificate, clientB.address);
  const certificates = await clientB.getCertificates(clientB.address);
  expect(certificates[0].title).toEqual(title);
  expect(certificates[0].ipfs).toEqual(ipfs);
  expect(certificates[0].time).not.toEqual(null);
  expect(certificates[0].time).not.toEqual(undefined);
  expect(certificates[0].sig.length > 0).toEqual(true);
  expect(certificates[0].by).toEqual(clientA.address);
  const receipts = await clientA.getReceipts();
  console.log(receipts);
  expect(receipts.length).toEqual(1);
  const certificatesIIssuesed = await clientA.getCertificatesIIssuesed();
  expect(certificatesIIssuesed[0].title).toEqual(certificates[0].title);
  expect(certificatesIIssuesed[0].ipfs).toEqual(certificates[0].ipfs);
  expect(certificatesIIssuesed[0].time).toEqual(certificates[0].time);
  expect(certificatesIIssuesed[0].sig).toEqual(certificates[0].sig);
  expect(certificatesIIssuesed[0].by).toEqual(certificates[0].by);
  expect(certificatesIIssuesed[0].to).toEqual(clientB.address);
});

test("register and get pubkey", async () => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  await clientA.init();
  await clientB.init();
  let pubkey = (await clientA.getProfile(clientA.address)).pubkey;
  expect(pubkey).toEqual(clientA.rsaKeyPair.pubKey);
  const dummyPubKey = clientB.rsaKeyPair.pubKey;
  await clientB.sendTransaction({
    "pubkey": dummyPubKey
  }, clientA.address);
  pubkey = (await clientA.getProfile(clientA.address)).pubkey;
  expect(pubkey).toEqual(clientA.rsaKeyPair.pubKey);
});

test("register name and icon", async () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://nodes.devnet.iota.org", passphrase);
  await client.init();
  await client.registerName("Alice1");
  await client.registerName("Alice2");
  await client.registerIcon("Image1");
  await client.registerIcon("Image2");
  const profile = await client.getProfile(client.address);
  expect(profile.name).toEqual("Alice2");
  expect(profile.icon).toEqual("Image2");
});


test("verify certificate", async () => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://nodes.devnet.iota.org", passphraseA);
  const clientB = new CertClient("https://nodes.devnet.iota.org", passphraseB);
  await clientA.init();
  await clientB.init();
  const ipfs = "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o";
  const title = "title";
  const description = "description";
  let certificate = clientA.createCertificateObject(title, description, ipfs, clientB.address);
  let verified = await clientB.verifyCertificate(certificate, clientB.address);
  expect(verified).toEqual(true);
  verified = await clientB.verifyCertificate(certificate, clientA.address);
  expect(verified).toEqual(false);
  certificate = clientA.createCertificateObject(title, ipfs, clientB.address);
  certificate.title = "dummy";
  verified = await clientB.verifyCertificate(certificate, clientB.address);
  expect(verified).toEqual(false);
});
