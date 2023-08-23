function arrayToJSON(headers, arrayData) {
    let jsonData = arrayData.map((row) => {
      let rowObj = {};
      headers.forEach((header) => {
        rowObj[header] = row[header];
      });
      return rowObj;
    });
    return jsonData;
}
  
module.exports = { arrayToJSON };
