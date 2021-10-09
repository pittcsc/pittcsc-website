const NodeCache = require("node-cache");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const projectCache = new NodeCache({
  stdTTL: 86400, // cache entry should be removed after 24 hours
  deleteOnExpire: true,
});

const SHEET_CACHE_KEY = "project_sheet";

// It takes time to connect to the sheet, so consumers of the sheet should
// await the promise.
const sheet = (async() => {
  const sheet = new GoogleSpreadsheet("1hxiXzFyLKy1vreEobJml3nthc__mb7ooaztyvGR-luI");

  await sheet.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SHEETS_API_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_API_KEY,
  });

  await sheet.loadInfo();

  return sheet;
})();

async function getProjectsFromSheet() {
  const projectSheet = (await sheet).sheetsByTitle["Projects"];

  return (await projectSheet.getRows()).map((row) => projectSheet.headerValues.reduce((acc, headerValue) => {
    acc[headerValue] = row[headerValue];
    return acc;
  }, {}));
}

async function getProjects() {
  const cachedProjects = projectCache.get(SHEET_CACHE_KEY)
  if (cachedProjects) {
    return cachedProjects;
  }

  const projects = await getProjectsFromSheet();
  projectCache.set(SHEET_CACHE_KEY, projects);
  return projects;
}

export default async function handler(req, res) {
  res.json(await getProjects());
}