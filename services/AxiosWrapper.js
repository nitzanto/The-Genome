const axios = require("axios");
const https = require("https");
const zlib = require("zlib");

class AxiosWrapper {
  constructor() {
    this.cache = {};
  }

  async getS3File(s3Url) {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    let httpsUrl = s3Url.replace(
        `s3://${S3_Object_URL}`,
        `https://${S3_Object_URL}.s3.amazonaws.com`
    );

    try {
      // Fetch the S3 file and return a readable stream of gzipped data
      const response = await axios({
        method: "GET",
        url: httpsUrl,
        responseType: "stream",
        httpsAgent: httpsAgent,
      });

      return response.data.pipe(zlib.createGunzip()); // 1) Used the pipe() method to pipe the downloaded data directly
    } catch (error) {
      throw new Error(`Error fetching S3 file: ${error.message}`);
    }
  }

  async addGeneField(row) {
    const key = `${row["CHROM"]}_${row["POS"]}_${row["REF"]}_${row["ALT"]}`; // 2) Cached the API Responses

    if (this.cache[key]) {
      return `;GENE=${this.cache[key]}`;
    }

    try {
      // Make API request to fetch variant details
      let response = await this.post(
          `https://${API_URL}/fetch_variant_details`,
          {
            chr: row["CHROM"],
            pos: row["POS"],
            ref: row["REF"],
            alt: row["ALT"],
            reference_version: "hg19",
          }
      );

      let gene = response.data.gene; // Extract gene data from the API response
      this.cache[key] = gene; // Cache the gene data for future use
      return `;GENE=${gene}`;
    } catch (error) {
      throw new Error(`Error fetching variant details: ${error.message}`);
    }
  }

  async post(url, data) {
    try {
      // Make a POST request to the specified URL with the provided data
      let response = await axios.post(url, data);
      return response;
    } catch (error) {
      throw new Error(`Error during API request: ${error.message}`);
    }
  }
}

module.exports = AxiosWrapper;
