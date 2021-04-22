const IpfsHttpClient = require("ipfs-http-client");

function IpfsClient (host) {
  const ipfs = IpfsHttpClient({
    host: host,
    port: 5001,
    protocol: "https",
  });
  function createImageUrlFromUint8Array(arr) {
    const blob = new Blob([arr]);
    const urlCreator = window.URL || window.webkitURL;
    const imageUrl = urlCreator.createObjectURL(blob);
    return imageUrl;
  }
  this.postResource = async function (resource) {
    const response = await ipfs.add(text);
    if (response) {
      return response.path;
    }
    throw new Error("couldn't post the text to IPFS network.");
  }
  var concatBuffer = function (buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  };
  this.getTextOnIpfs = async function (ipfsHash) {
    console.log("ipfs text");
    const response = await ipfs.get(ipfsHash);
    for await (const data of response) {
      console.log(data);
      let content = new ArrayBuffer(0);
      for await (const chunk of data.content) {
        content = concatBuffer(content, chunk);
      }
      return uintToString(new Uint8Array(content));
    }
    return null;
  }
  this.getImageOnIpfs = async function (ipfsHash) {
    console.log("ipfs image");
    const response = await ipfs.get(ipfsHash);
    for await (const data of response) {
      console.log(data);
      let content = new ArrayBuffer(0);
      for await (const chunk of data.content) {
        content = concatBuffer(content, chunk);
      }
      const url = createImageUrlFromUint8Array(content);
      return url;
    }
    return null;
  }
}


module.exports = IpfsClient;
