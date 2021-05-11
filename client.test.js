const expect = require("expect");
const CertClient = require("./client");
const {randomBytes} = require('crypto')

function generateRandomString(length) {
  return randomBytes(length).reduce((p, i) => p + (i % 36).toString(36), '')
}

test("get first address by cert client", async() => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseA);
  const clientB = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseB);
  const clientC = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseA);
  await clientA.init();
  await clientB.init();
  const addressA = clientA.address;
  const addressB = clientB.address;
  const addressC = clientC.address;
  expect(addressA).toEqual(addressC);
  expect(addressA).not.toEqual(addressB);
});


test("sign and verify", async() => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseA);
  const clientB = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseB);
  await clientA.init();
  await clientB.init();
  const signature = clientA.sign(clientB.address);
  let verified = clientB.verify(clientB.address, signature, clientA.rsaKeyPair.pubKey);
  expect(verified).toEqual(true);
  verified = clientB.verify("hello", signature, clientA.rsaKeyPair.pubKey);
  expect(verified).toEqual(false);
});

test("certificate text", () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphrase);
  const text = client.certificateText("title", "description", "abcd", new Date(), client.address);
  expect(text.endsWith("title:description:abcd:" + client.address) && text.length > 4).toEqual(true);
});

test("post and get bundle", async () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphrase);
  await client.init();
  await client.sendMessage({
    time: Math.floor(new Date().getTime() / 1000),
    hello: "world"
  }, client.address);
  const messages = await client.getMessages(client.address);
  expect(messages.length).toEqual(2);
  expect(messages[1].hello).toEqual("world");
});

test("is pubkey json", () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphrase);
  let isPubKey = client.isPubKeyObject({
    pubkey: "helloworld"
  });
  expect(isPubKey).toEqual(true);
  isPubKey = client.isPubKeyObject({});
  expect(isPubKey).toEqual(false);
});

test("is certificate json", () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphrase);
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
  const clientA = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseA);
  const clientB = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseB);
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
  const clientA = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseA);
  const clientB = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseB);
  await clientA.init();
  await clientB.init();
  const ipfs = "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o";
  const title = await clientA.ipfsClient.postResource("title");
  const description = await clientA.ipfsClient.postResource("description");
  const certificate = clientA.createCertificateObject(title, description, ipfs, clientB.address);
  await clientA.issueCertificate(certificate, clientB.address);
  const certificates = await clientB.getCertificates(clientB.address);
  expect(certificates[0].title).toEqual(title);
  expect(certificates[0].ipfs).toEqual(ipfs);
  expect(certificates[0].time).not.toEqual(null);
  expect(certificates[0].time).not.toEqual(undefined);
  expect(certificates[0].sig.length > 0).toEqual(true);
  expect(certificates[0].by).toEqual(clientA.address);
  await clientB.getTitle(clientB.address, 0);
  expect(certificates[0].titleInIpfs).toEqual("title");
  await clientB.getDescription(clientB.address, 0);
  expect(certificates[0].descriptionInIpfs).toEqual("description");
  const receipts = await clientA.getReceipts();
  console.log(receipts);
  expect(receipts.length).toEqual(1);
  const certificatesIIssued = await clientA.getCertificatesIIssued();
  expect(certificatesIIssued[0].title).toEqual(certificates[0].title);
  expect(certificatesIIssued[0].ipfs).toEqual(certificates[0].ipfs);
  expect(certificatesIIssued[0].time).toEqual(certificates[0].time);
  expect(certificatesIIssued[0].sig).toEqual(certificates[0].sig);
  expect(certificatesIIssued[0].by).toEqual(certificates[0].by);
  expect(certificatesIIssued[0].to).toEqual(clientB.address);
  await clientA.getTitleIIssued(clientA.address, 0);
  expect(certificatesIIssued[0].titleInIpfs).toEqual("title");
  await clientA.getDescriptionIIssued(clientA.address, 0);
  expect(certificatesIIssued[0].descriptionInIpfs).toEqual("description");
});

test("register and get pubkey", async () => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseA);
  const clientB = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseB);
  await clientA.init();
  await clientB.init();
  let pubkey = (await clientA.getProfile(clientA.address)).pubkey;
  expect(pubkey).toEqual(clientA.rsaKeyPair.pubKey);
});

test("register name and icon", async () => {
  const passphrase = generateRandomString(32);
  const client = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphrase);
  await client.init();
  await client.registerName("Alice1");
  await client.registerName("Alice2");
  await client.registerIcon("Image1");
  await client.registerIcon("Image2");
  const profile = await client.getProfile(client.address);
  expect(profile.name).toEqual("QmTddebgzpxB91Wz3epcnFHs4eKyv24AFnUqJgy4ntvHJE"); //Alice2
  expect(profile.icon).toEqual("Image2");
});


test("verify certificate", async () => {
  const passphraseA = generateRandomString(32);
  const passphraseB = generateRandomString(32);
  const clientA = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseA);
  const clientB = new CertClient("https://api.lb-0.testnet.chrysalis2.com", passphraseB);
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

