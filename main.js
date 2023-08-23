const VcfProcessor = require("./services/VcfProcessor");
const AxiosWrapper = require("./services/AxiosWrapper");
const { Parser } = require("json2csv");
const {log} = require("util");

const axiosWrapper = new AxiosWrapper();
const parser = new Parser();

async function getS3FileStream(s3Url) {
  try {
    let fileStream = await axiosWrapper.getS3File(s3Url);
    return fileStream;
  } catch (error) {
    console.error("Error fetching S3 file:", error.message);
    process.exit(1);
  }
}

async function processVcfFile(stream, start, end, minDP, limit, deNovo) {
  try {
    let vcfProcessor = new VcfProcessor(stream, parser, axiosWrapper);
    await vcfProcessor.loadFromStream(start, end, minDP, limit, deNovo);
  } catch (error) {
    console.error("Error processing VCF file:", error.message);
    process.exit(1);
  }
}

(async () => {
  let start = process.argv[2];
  let end = process.argv[3];
  let minDP = process.argv[4];
  let limit = process.argv[5];
  let deNovo = process.argv[6];

  let fileStream = await getS3FileStream(
      `s3://${S3_Object_URL}/demo_vcf_multisample.vcf.gz`
  );
  await processVcfFile(fileStream, 2059966, 5059966, 5, 5, true);
  console.log("The VCF file has been successfully processed");
})();
