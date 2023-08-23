const readline = require("readline");
const fsp = require("fs").promises;
const fs = require("fs");
const { arrayToJSON } = require("../utils/utils");

class VcfProcessor {
  constructor(stream, parser, axiosWrapper) {

    this.stream = stream;
    this.parser = parser;
    this.axiosWrapper = axiosWrapper;
    this.dataFrames = {};
    this.counts = {};
    this.limitReachedCounts = 0;
    this.samplesLimitReached = {};
  }

  async loadFromStream(start, end, minDP, limit, deNovo) {
    let rl = readline.createInterface({
      input: this.stream,
      crlfDelay: Infinity,
    });

    try {
      // Read and process each line from the VCF file
      for await (const line of rl) {
        if (line.startsWith("#")) {
          this.columns = line.slice(1).split("\t");
          continue;
        }


        let row = line.split("\t"); 
        let rowData = {};
        this.columns.forEach((header, index) => {
          rowData[header] = row[index];
        });

        await this.processRow(rowData, start, end, minDP, limit, deNovo); // Process each row as soon as it's read, now we'll never excceed out of memory.
        if (
            this.limitReachedCounts >=
            this.columns.slice(this.columns.indexOf("FORMAT") + 1).length
        ) {
          // As soon as we find out that we have reached the limit for all the samples, we break and finish our program.
          break;
        }
      }
    } catch (error) {
      throw new Error(`Error loading VCF data: ${error.message}`);
    }
  }

  async processRow(rowData, start, end, minDP, limit, deNovo) {
    let samples = this.columns.slice(this.columns.indexOf("FORMAT") + 1);
    try {
      // Process each sample data for the current variant row
      for (let sample of samples) {
        if (
            rowData[sample] !== "./.:.:.:.:.:.:." &&
            !this.samplesLimitReached[sample]
        ) {
          // Making sure to not processSampleData of varient from sample that has already reached its limit.
          await this.processSampleData(
              sample,
              rowData,
              start,
              end,
              minDP,
              limit,
              deNovo
          );
        }
      }
    } catch (error) {
      throw new Error(`Error processing row data: ${error.message}`);
    }
  }

  async processSampleData(sample, rowData, start, end, minDP, limit, deNovo) {
    try {
      if (!this.checkDeNovo(sample, rowData, deNovo)) return; //3) added deNovo parameter
      if (!this.filterByPos(rowData, start, end)) return;
      if (!(this.filterByMinDP(rowData, minDP, sample))) return;

      if (!rowData["INFO"].includes("GENE=")) {
        let geneField = await this.axiosWrapper.addGeneField(rowData);
        rowData["INFO"] += geneField;
      }

      if (!this.counts[sample]) {
        this.counts[sample] = 0;
      }
      this.counts[sample]++;

      if (this.counts[sample] > limit) {
        this.samplesLimitReached[sample] = true;
        this.limitReachedCounts++;
        return;
      }

      if (!this.dataFrames[sample]) {
        this.dataFrames[sample] = [];
      }
      this.dataFrames[sample].push(rowData);

      let jsonData = arrayToJSON(this.columns, this.dataFrames[sample]);
      let csv = this.parser.parse(jsonData);
      await fsp.writeFile(`data\\\\${sample}_filtered.vcf`, csv);
    } catch (error) {
      throw new Error(`Error processing sample data: ${error.message}`);
    }
  }

  filterByPos(rowData, start, end) {
    return rowData["POS"] >= start && rowData["POS"] <= end;
  }

  async filterByMinDP(row, minDP, sample) {
    try {
      let formatFields = row["FORMAT"].split(":");
      let dpIndex = formatFields.indexOf("DP");
      if (dpIndex === -1) return false;
      let sampleFields = row[sample].split(":");
      let dpValue = Number(sampleFields[dpIndex]);
      return dpValue > minDP;
    } catch (error) {
      throw new Error(`Error filtering by minDP: ${error.message}`);
    }
  }

  checkDeNovo(sample, rowData, deNovo) {
    try {
      if (sample === "proband") {
        if (
            (deNovo === true &&
                rowData["father"] === "./.:.:.:.:.:.:." &&
                rowData["mother"] === "./.:.:.:.:.:.:.") ||
            (deNovo === false &&
                (rowData["father"] !== "./.:.:.:.:.:.:." ||
                    rowData["mother"] !== "./.:.:.:.:.:.:."))
        ) {
          return true;
        }
        return false;
      }
      return true;
    } catch (error) {
      throw new Error(`Error checking deNovo: ${error.message}`);
    }
  }
}

module.exports = VcfProcessor;
