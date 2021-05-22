const { sendData, SingleNodeClient, Converter, retrieveData } = require("@iota/iota.js");
const { getSeed } = require("./seed");
const { getKeyPair } = require("./rsa");
const crypto = require("crypto");
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
    if (uid) {
      this.address = crypto.createHash("sha256").update(uid, "utf8").digest("hex").slice(0, 48);
    }
    this.cache = {
      certificates: {},
      profiles: {},
      messages: {},
      milestones: {},
    }
  }
  async init() {
    try {
      this.profile = await this.getProfile(this.address);
    } catch(err) {
      console.error(err);
      await this.registerPubKey(this.rsaKeyPair.pubKey);
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
  async sendMessage(obj, address) {
    const index = "gxcert:" + address;
    const indexBytes = Converter.utf8ToBytes(index);
    const body = JSON.stringify(obj);
    const bodyBytes = Converter.utf8ToBytes(body);
    const message = await sendData(this.iotaClient, indexBytes, bodyBytes);
    console.log(message);
    return message.messageId;
  }
  async getMessage(messageId) {
    const client = this.iotaClient;
    let message;
    if (messageId in this.cache.messages) {
      message = this.cache.messages[messageId];
    } else {
      message = await retrieveData(client, messageId);
    }
    if (message && message.data) {
      let data;
      try {
        data = JSON.parse(Converter.bytesToUtf8(message.data));
      } catch(err) {
        console.error(err);
      }
      this.cache.messages[messageId] = message;
      return data;
    }
    throw new Error("The message not found.");
  }
  async getMessages(address) {
    const client = this.iotaClient;
    const index = "gxcert:" + address;
    const indexBytes = Converter.utf8ToBytes(index);
    const found = await client.messagesFind(indexBytes);
    console.log("found");
    console.log(found);
    const messageIds = found.messageIds;
    const messages = [];
    for (const messageId of messageIds) {
      let message;
      if (messageId in this.cache.messages) {
        message = this.cache.messages[messageId];
      } else {
        message = await retrieveData(client, messageId);
      }
      const metadata = await this.iotaClient.messageMetadata(messageId);
      let timestamp;
      if (metadata.referencedByMilestoneIndex) {
        const index = metadata.referencedByMilestoneIndex;
        let milestone;
        if (index.toString() in this.cache.milestones) {
          milestone = this.cache.milestones[index.toString()];
        } else {
          milestone = await this.iotaClient.milestone(metadata.referencedByMilestoneIndex);
        }
        this.cache.milestones[index.toString()] = milestone;
        timestamp = milestone.timestamp;
      }
      if (message && message.data) {
        try {
          const data = JSON.parse(Converter.bytesToUtf8(message.data));
          if (timestamp) {
            data.timestamp = timestamp;
          }
          messages.push(data);
        } catch(err) {
          console.error(err);
        }
        this.cache.messages[messageId] = message;
      }
    }
    messages.sort((a, b) => {
      if (!a.timestamp) {
        return -1;
      }
      if (!b.timestamp) {
        return 1;
      }
      if (a.timestamp > b.timestamp) {
        return 1;
      }
      return -1;
    });
    console.log(messages);
    return messages;
  }
  async registerPubKey(pubKey) {
    return await this.sendMessage({
      pubkey: pubKey,
    }, this.address);
  }
  async registerName(name) {
    const time = Math.floor((new Date()).getTime() / 1000);
    const ipfsHash = await this.ipfsClient.postResource(name);
    const sig = this.sign(ipfsHash);
    return await this.sendMessage({
      "name": ipfsHash,
      sig,
      time,
    }, this.address);
  }
  async registerIcon(ipfsHash) {
    if (!ipfsHash) {
      throw new Error("The name must be 16 characters or less.");
    }
    const time = Math.floor((new Date()).getTime() / 1000);
    const sig = this.sign(ipfsHash);
    return await this.sendMessage({
      "icon": ipfsHash,
      sig,
      time,
    }, this.address);
  }
  async getProfile(address, update) {
    console.log("getProfile: " + address);
    let messages = await this.getMessages(address);
    let profile = {};
    for (const message of messages) {
      if (this.isPubKeyObject(message)) {
        profile.pubkey = message.pubkey;
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
    this.cache.profiles[address] = profile;
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
    if (!json.pubkey) {
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
    if (!json.messageId || !json.certHolder) {
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
  async issueCertificate(certObject, address) {
    const messageId = await this.sendMessage(certObject, address);
    const receipt = this.createReceiptObject(messageId, address);
    return await this.sendMessage(receipt, this.address);
  }
  createCertificateObject(title, description, ipfs, to) {
    const now = new Date();
    const time = Math.floor(now.getTime() / 1000);
    const text = this.certificateText(title, description, ipfs, now, to);
    const sig = this.sign(text);
    const by = this.address;
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
  async getReceipts(address) {
    if (!address) {
      address = this.address;
    }
    const that = this;
    const messages = await this.getMessages(address);
    const receipts = messages.filter(message => {
      return that.isReceiptObject(message);
    });
    return receipts;
  }
  async getCertificatesIIssued(address, update) {
    if (!address) {
      address = this.address;
    }
    const receipts = await this.getReceipts(address);
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
  async getImageUrl(address, index) {
    const certificates = await this.getCertificates(address);
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
  async getTitle(address, index) {
    const certificates = await this.getCertificates(address);
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
  async getDescription(address, index) {
    const certificates = await this.getCertificates(address);
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
  async getImageUrlIIssued(address, index) {
    const certificates = await this.getCertificatesIIssued(address);
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
  async getTitleIIssued(address, index) {
    const certificates = await this.getCertificatesIIssued(address);
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
  async getDescriptionIIssued(address, index) {
    const certificates = await this.getCertificatesIIssued(address);
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
  async getCertificates(address, update) {
    if (!address) {
      address = this.address;
    }
    const messages = await this.getMessages(address);
    const that = this;
    const certificates = messages.filter(message => {
      return that.isCertObject(message);
    }).map((certificate, index) => {
      if (address in this.cache.certificates && index < this.cache.certificates[address].length) {
        return this.cache.certificates[address][index];  
      }
      return certificate;
    });;
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
    this.cache.certificates[address] = validCertificates;
    if (update) {
      update(validCertificates);
    }
    return validCertificates;
  }
}

module.exports = CertClient;
