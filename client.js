const { SingleNodeClient } = require("@iota/iota.js");
const Extract = require("@iota/extract-json");
const Converter = require("@iota/converter");
const { getSeed } = require("./seed");
const { getKeyPair } = require("./rsa");
const cryptico = require("cryptico");
const IpfsClient = require("./ipfs");

const depth = 3;
const minimumWeightMagnitude = 9;

function reverse(arr){
  if(toString.call(arr) !== '[object Array]') return null;
  if(arr.length === 0) return arr;
  var copy = arr.slice();
  return copy.reverse();
}

class CertClient {
  constructor(apiEndpoint, uid) {
    this.iotaClient = new SingleNodeClient(apiEndpoint);
    if (uid) {
      this.rsaKeyPair = getKeyPair(uid);
    }
    this.uid = uid;
    this.profile = null;
    this.ipfsClient = new IpfsClient("ipfs.infura.io");
    this.cache = {
      certificates: {},
      profiles: {},
      bundles: {},
      hashToBundle: {},
    }
  }
  async init() {
    try {
      this.profile = await this.getProfile(this.address);
    } catch(err) {
      console.error(err);
    }
  }
  async verifyPubKey(pubKey) {
    if (this.rsaKeyPair.pubKey !== pubKey) {
      return false;
    }
    return true;
  }
  async verifyCertificate(certificate, to) {
    const text = this.certificateText(certificate.title, certificate.description, certificate.ipfs, certificate.time, to);
    const profile = await this.getProfile(certificate.by);
    return this.verify(text, certificate.sig, profile.pubkey);
  }
  async sendMessage(obj, to) {
    
  }
  async getMessages(pubKey) {
    const index = "gxcert:" + pubKey;

  }
  async registerName(name) {
    const ipfsHash = await this.ipfsClient.postResource(name);
    const sig = this.sign(ipfsHash);
    return await this.sendMessage({
      "name": ipfsHash,
      "sig": sig,
    }, this.rsaKeyPair.pubKey);
  }
  async registerIcon(ipfsHash) {
    if (!ipfsHash) {
      throw new Error("The name must be 16 characters or less.");
    }
    const sig = this.sign(ipfsHash);
    return await this.sendMessage({
      "icon": ipfsHash,
      "sig": sig,
    }, this.rsaKeyPair.pubKey);
  }
  async getProfile(pubKey, update) {
    console.log("getProfile: " + pubKey);
    let messages = await this.getMessages(pubKey);
    let profile = {};
    for (const message of messages) {
      if (this.isPubKeyObject(message)) {
        profile.pubkey = bundle.pubkey;
        break;
      }
    }
    if (!profile.pubkey) {
      throw new Error("public key is not found.");
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (this.isNameObject(message) && this.verify(message.name, message.sig, profile.pubkey)) {
        profile.name = message.name;
        this.ipfsClient.getTextOnIpfs(profile.name).then(name => {
          profile.nameInIpfs = name;
          if (update) {
            update(profile);
          }
        }).catch(err => {
          console.error(err);
        });
        break;
      }
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (this.isIconObject(message) && this.verify(message.icon, message.sig, profile.pubkey)) {
        profile.icon = message.icon;
        this.ipfsClient.getImageOnIpfs(profile.icon).then(imageUrl => {
          profile.imageUrl = imageUrl;
          if (update) {
            update(profile);
          }
        }).catch(err => {
          console.error(err);
        });
        break;
      }
    }
    this.cache.profiles[pubKey] = profile;
    if (update) {
      update(profile);
    }
    return profile;
  }
  certificateText(title, description, ipfs, date, to) {
    let time = date;
    if (date instanceof Date) {
      time = Math.floor(date.getTime() / 1000);
    }
    return time.toString() + ":" + title + ":" + description + ":" + ipfs + ":" + to;
  }
  isPubKeyObject(json) {
    if (!json.pubkey || !json.time) {
      return false;
    }
    return true;
  }
  isNameObject(json) {
    if (!json.name || !json.sig || !json.time) {
      return false;
    }
    return true;
  }
  isIconObject(json) {
    if (!json.icon || !json.sig || !json.time) {
      return false;
    }
    return true;
  }
  isCertObject(json) {
    if (!json.ipfs || !json.description || !json.time || !json.sig || !json.by || !json.title) {
      return false;
    }
    return true;
  }
  isReceiptObject(json) {
    if (!json.messageId || !json.certHolder || !json.time) {
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
      return a.timestamp > b.timestamp;
    });
    const hashes = transactions.map(transaction => {
      return transaction.hash;
    });
    let bundles = [];
    for (const hash of hashes) {
      let json;
      if (hash in this.cache.hashToBundle) {
        json = this.cache.hashToBundle[hash];
      } else {
        try {
          const bundle = await this.iota.getBundle(hash);
          json = JSON.parse(Extract.extractJson(bundle));
        } catch(err) {
          console.error(err);
          continue;
        }
      }
      console.log("get bundle");
      this.cache.hashToBundle[hash] = json;
      bundles.push(json);
    }
    this.cache.bundles[address] = bundles;
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
  async issueCertificate(certObject, pubKey) {
    const messageId = await this.sendMessage(certObject, pubKey);
    const receipt = this.createReceiptObject(messageId, pubKey);
    return await this.sendMessage(receipt, this.rsaKeyPair.pubKey);
  }
  createCertificateObject(title, description, ipfs, to) {
    const now = new Date();
    const time = Math.floor(now.getTime() / 1000);
    const text = this.certificateText(title, description, ipfs, now, to);
    const sig = this.sign(text);
    const by = this.rsaKeyPair.pubKey;
    return {
      title,
      description,
      ipfs,
      time,
      sig,
      by,
    }
  }
  createReceiptObject(messageId, certHolder) {
    return {
      messageId,
      certHolder,
    }
  }
  async getReceipts(pubKey) {
    if (!pubKey) {
      pubKey = this.rsaKeyPair.pubKey;
    }
    const that = this;
    const messages = await this.getMessages(pubKey);
    const receipts = messages.filter(message => {
      return that.isReceiptObject(message);
    });
    return receipts;
  }
  async getCertificatesIIssued(pubKey, update) {
    if (!pubKey) {
      pubKey = this.rsaKeyPair.pubKey;
    }
    const receipts = await this.getReceipts(pubKey);
    const messageIds = receipts.map(receipt => {
      return receipt.messageId;
    });
    let messages = [];
    for (const messageId of messageIds) {
      let message;
      if (messageId in this.cache.messages) {
        message = this.cache.messages[messageId];
      } else {
        message = await this.getMessage(messageId);
      }
      this.cache.messages[messageId] = message;
      messages.push(message);
    }
    for (let i = 0; i < receipts.length; i++) {
      const to = receipts[i].certHolder;
      messages[i].to = to;
    }
    if (update) {
      update(messages);
    }
    return messages;
  }
  async getImageUrl(pubKey, index) {
    const certificates = await this.getCertificates(pubKey);
    let imageUrl;
    try {
      imageUrl = await this.ipfsClient.getImageOnIpfs(certificates[index].ipfs);
    } catch(err) {
      console.error(err);
      return certificates;
    }
    certificates[index].imageUrl = imageUrl;
    return certificates;
  }
  async getTitle(pubKey, index) {
    const certificates = await this.getCertificates(pubKey);
    let title;
    try {
      title = await this.ipfsClient.getTextOnIpfs(certificates[index].title);
    } catch(err) {
      console.error(err);
      return certificates;
    }
    certificates[index].titleInIpfs = title;
    return certificates;
  }
  async getDescription(pubKey, index) {
    const certificates = await this.getCertificates(pubKey);
    let description;
    try {
      description = await this.ipfsClient.getTextOnIpfs(certificates[index].description);
    } catch(err) {
      console.error(err);
      return certificates;
    }
    certificates[index].descriptionInIpfs = description;
    return certificates;
  }
  async getImageUrlIIssued(pubKey, index) {
    const certificates = await this.getCertificatesIIssued(pubKey);
    let imageUrl;
    try {
      imageUrl = await this.ipfsClient.getImageOnIpfs(certificates[index].ipfs);
    } catch(err) {
      console.error(err);
      return certificates;
    }
    certificates[index].imageUrl = imageUrl;
    return certificates;
  }
  async getTitleIIssued(pubKey, index) {
    const certificates = await this.getCertificatesIIssued(pubKey);
    let title;
    try {
      title = await this.ipfsClient.getTextOnIpfs(certificates[index].title);
    } catch(err) {
      console.error(err);
      return certificates;
    }
    certificates[index].titleInIpfs = title;
    return certificates;
  }
  async getDescriptionIIssued(pubKey, index) {
    const certificates = await this.getCertificatesIIssued(pubKey);
    let description;
    try {
      description = await this.ipfsClient.getTextOnIpfs(certificates[index].description);
    } catch(err) {
      console.error(err);
      return certificates;
    }
    certificates[index].descriptionInIpfs = description;
    return certificates;
  }
  async getCertificates(pubKey, update) {
    if (!address) {
      pubKey = this.rsaKeyPair.pubKey;
    }
    const messages = await this.getMessages(pubKey);
    const that = this;
    const certificates = messages.filter(message => {
      return that.isCertObject(message);
    });
    const validCertificates = [];
    for (const certificate of certificates) {
      const by = certificate.by;
      const time = certificate.time;
      const sig = certificate.sig;
      const ipfs = certificate.ipfs;
      const title = certificate.title;
      const description = certificate.description;
      let profile;
      if (by in this.cache.profiles) {
        profile = this.cache.profiles[by];
      } else {
        profile = await this.getProfile(by);
      }
      const pubKey = profile.pubkey;
      const name = profile.name;
      if (!certificate.issuerName) {
        this.ipfsClient.getTextOnIpfs(name).then(name => {
          certificate.issuerName = name;
          if (update) {
            update(validCertificates);
          }
        }).catch(err => {
          console.error(err);
        });
      }
      validCertificates.push(certificate);
    }
    this.cache.certificates[pubKey] = validCertificates;
    if (update) {
      update(validCertificates);
    }
    return validCertificates;
  }
}

module.exports = CertClient;
