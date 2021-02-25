const Iota = require("@iota/core");
const Extract = require("@iota/extract-json");
const Converter = require("@iota/converter");
const { getSeed } = require("./seed");
const { getKeyPair } = require("./rsa");

class CertClient {
  constructor(uid) {
    this.iota = Iota.composeAPI({
      provider: "https://nodes.devnet.iota.org"
    });
    this.rsaKeyPair = getKeyPair(uid);
    this.seed = getSeed(uid);
  }
  async init() {
    this.address = await this.getFirstAddress();
    console.log(this.address);
  }
  async getFirstAddress(seed) {
    if (!seed) {
      return (await this.iota.getNewAddress(this.seed, { index: 0, securityLevel: 2, total: 1}))[0];
    }
    return (await this.iota.getNewAddress(seed, { index: 0, securityLevel: 2, total: 1 }))[0];
  }
  async verifyAddress(seed) {
    const address = await this.getFirstAddress(seed);
    if (this.address !== address) {
      return false;
    }
    return true;
  }
  isCertObject(json) {
    return true;
  }
  async createCertificate(from, to, ipfsHash) {
    const message = {
      ipfsHash: ipfsHash,
      from: from,
    }
    const messageString = JSON.stringify(message);
    const messageInTrytes = Converter.asciiToTrytes(message);
    const transfers = [
      {
        value: 0,
        address: to,
      }
    ];
  }
  async getCertificates() {
    const transactions = await this.iota.findTransactionObjects({ addresses: [this.address] });
    const hashes = transactions.map(transaction => {
      return transaction.hash;
    });
    const certificates = [];
    for (const hash of hashes) {
      const bundle = await this.iota.getBundle(hash);
      const json = JSON.parse(Extract.extractJson(bundle));
      if (this.isCertObject(json)) {
        certificates.push(json);
      }
    }
  }
}

(async () => {
  const client = new CertClient("AOBFZFANUZDXOQKQJPNXVHCBTCIIILAIAZLDYU9TLACKYWNTHUBDYSAHXEBJDVFRCJLVNGMONGMSCLADM");
  await client.init();
  await client.getCertificates();
})();
