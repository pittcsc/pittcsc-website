const NodeCache = require("node-cache");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const projectCache = new NodeCache({
  stdTTL: 86400, // cache entry should be removed after 24 hours
  deleteOnExpire: true,
});

// It takes time to connect to the sheet, so consumers of the sheet should
// await the promise.
const projectSheet = (async() => {
  const sheet = new GoogleSpreadsheet("1hxiXzFyLKy1vreEobJml3nthc__mb7ooaztyvGR-luI");

  await sheet.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SHEETS_API_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_API_KEY,
  });

  await sheet.loadInfo();

  return sheet;
})();

export default async function handler(req, res) {
  // Just need to read docs to see how to read entire sheet
  res.json();
}