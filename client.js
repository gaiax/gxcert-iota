const Iota = require("@iota/core");
const Extract = require("@iota/extract-json");
const Converter = require("@iota/converter");
const { getSeed } = require("./seed");
const { getKeyPair } = require("./rsa");
const cryptico = require("cryptico");

const depth = 3;
const minimumWeightMagnitude = 9;

class CertClient {
  constructor(provider, uid) {
    this.iota = Iota.composeAPI({
      provider
    });
    this.rsaKeyPair = getKeyPair(uid);
    this.seed = getSeed(uid);
    this.cache = {
      certificates: {},
      profiles: {},
    }
  }
  async init() {
    this.address = await this.getFirstAddress();
    try {
      await this.getProfile(this.address);
    } catch(err) {
      await this.registerPubKey();
    }
    console.log(this.address);
  }
  async getFirstAddress(seed) {
    if (!seed) {
      return (await this.iota.getNewAddress(this.seed, { index: 0, securityLevel: 2, total: 1}))[0];
    }
    return (await this.iota.getNewAddress(seed, { index: 0, securityLevel: 2, total: 1 }))[0];
  }
  async verifyAddress(address) {
    if (this.address !== address) {
      return false;
    }
    return true;
  }
  async registerPubKey() {
    const pubKey = this.rsaKeyPair.pubKey;
    return await this.sendTransaction({
      "pubkey": pubKey
    }, this.address);
  }
  async registerName(name) {
    if (name.length > 16) {
      throw new Error("The name must be 16 characters or less.");
    }
    const sig = this.sign(name);
    return await this.sendTransaction({
      "name": name,
      "sig": sig,
    }, this.address);
  }
  async registerIcon(ipfsHash) {
    if (!ipfsHash) {
      throw new Error("The name must be 16 characters or less.");
    }
    const sig = this.sign(ipfsHash);
    return await this.sendTransaction({
      "icon": ipfsHash,
      "sig": sig,
    }, this.address);
  }
  async getProfile(address) {
    console.log("getProfile: " + address);
    const bundles = await this.getBundles(address);
    let pubkey = null;
    let name = null;
    let icon = null;
    for (const bundle of bundles) {
      if (this.isPubKeyObject(bundle)) {
        pubkey = bundle.pubkey;
        break;
      }
    }
    if (pubkey === null) {
      throw new Error("public key is not found.");
    }
    bundles.reverse();
    for (const bundle of bundles) {
      if (this.isNameObject(bundle) && this.verify(bundle.name, bundle.sig, pubkey)) {
        name = bundle.name;
        break;
      }
    }
    for (const bundle of bundles) {
      if (this.isIconObject(bundle) && this.verify(bundle.icon, bundle.sig, pubkey)) {
        icon = bundle.icon;
        break;
      }
    }
    return {
      pubkey,
      name,
      icon,
    }
  }
  certificateText(ipfs, date) {
    let time = date;
    if (date instanceof Date) {
      time = Math.floor(date.getTime() / 1000);
    }
    return time.toString() + ":" + ipfs;
  }
  isPubKeyObject(json) {
    if (!json.pubkey) {
      return false;
    }
    return true;
  }
  isNameObject(json) {
    if (!json.name || !json.sig) {
      return false;
    }
    return true;
  }
  isIconObject(json) {
    if (!json.icon || !json.sig) {
      return false;
    }
    return true;
  }
  isCertObject(json) {
    if (!json.ipfs || !json.time || !json.sig || !json.by) {
      return false;
    }
    return true;
  }
  sign(text) {
    const privKey = this.rsaKeyPair.privKey;
    const signature = privKey.signString(text, "sha256");
    return signature;
  }
  verify(text, signature, pubKey) {
    const key = cryptico.publicKeyFromString(pubKey);
    return key.verifyString(text, signature);
  }
  async getBundles(address) {
    const transactions = (await this.iota.findTransactionObjects({ addresses: [address] })).sort((a, b) => {
      if (a.timestamp > b.timestamp) {
        return 1; 
      }
      if (a.timestamp < b.timestamp) {
        return -1;
      }
      return 0;
    });
    const hashes = transactions.map(transaction => {
      return transaction.hash;
    });
    let bundles = [];
    for (const hash of hashes) {
      const bundle = await this.iota.getBundle(hash);
      const json = JSON.parse(Extract.extractJson(bundle));
      bundles.push(json);
    }
    return bundles;
  }
  async sendTransaction(messageObject, to) {
    const messageString = JSON.stringify(messageObject);
    const messageInTrytes = Converter.asciiToTrytes(messageString);
    const transfers = [
      {
        value: 0,
        address: to,
        message: messageInTrytes,
      }
    ]
    const trytes = await this.iota.prepareTransfers(this.seed, transfers);
    const bundle = await this.iota.sendTrytes(trytes, depth, minimumWeightMagnitude);
    const hash = bundle[0].hash;
    return hash;
  }
  async issueCertificate(certObject, address) {
    return await this.sendTransaction(certObject, address);
  }
  createCertificateObject(ipfs) {
    const now = new Date();
    const time = Math.floor(now.getTime() / 1000);
    const text = this.certificateText(ipfs, now);
    const sig = this.sign(text);
    const by = this.address;
    return {
      ipfs,
      time,
      sig,
      by,
    }
  }
  async getCertificate(address, index) {
    if (!address) {
      address = this.address;
    }
    const bundles = await this.getBundles(address);
    const that = this;
    const certificates = bundles.filter(bundle => {
      return that.isCertObject(bundle);
    });
    const certificate = certificates[index];
    const by = certificate.by;
    const time = certificate.time;
    const sig = certificate.sig;
    const info = await this.getProfile(by);
    const pubKey = info.pubkey;
    const name = info.name;
    certificate.issuserName = name;
    const verified = this.verify(this.certificateText(certificate.ipfs, time), sig, pubKey);
    if (verified) {
      return certificate;
    }
    throw new Error("Certificate is invalid");
  }
  async getCertificates(address) {
    if (!address) {
      address = this.address;
    }
    const bundles = await this.getBundles(address);
    const that = this;
    const certificates = bundles.filter(bundle => {
      return that.isCertObject(bundle);
    });
    const validCertificates = [];
    for (const certificate of certificates) {
      const by = certificate.by;
      const time = certificate.time;
      const sig = certificate.sig;
      let profile;
      if (by in this.cache.profiles) {
        profile = this.cache.profiles[by];
      } else {
        profile = await this.getProfile(by);
        this.cache.profiles[by] = profile;
      }
      const pubKey = profile.pubkey;
      const name = profile.name;
      certificate.issueserName = name;
      const verified = this.verify(this.certificateText(certificate.ipfs, time), sig, pubKey);
      if (verified) {
        validCertificates.push(certificate);
      }
    }
    this.cache.certificates[address] = validCertificates;
    return validCertificates;
  }
}

module.exports = CertClient;
