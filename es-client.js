
const axiosBase = require("axios");

class EsClient {
  constructor(baseURL) {
    this.axios = axiosBase.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
      responseType: "json"
    });
  }
  async getCertificates(address) {
    const response = await this.axios.get("/certificates/" + address);
    return response.data;
  }
  async getCertificatesIIssued(address) {
    const response = await this.axios.get("/issued/" + address);
    return response.data;
  }
}

module.exports = EsClient;
