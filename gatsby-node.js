const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv").config();
const { Client } = require("@notionhq/client");

const notion = new Client({
  auth: process.env.GATSBY_NOTION_TOKEN,
});

const database_id = process.env.GATSBY_NOTION_DATABASE_ID;

// Emit PDF.js's worker as a same-origin asset, rather than executing its source
// in the page bundle. The reader itself is loaded only on an autofill request.
exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    module: {
      rules: [{ test: /pdf\.worker\.min\.mjs$/, type: "asset/resource" }],
    },
  });
};

// Only this separate dashboard subtree is client-routed. Its generated HTML
// contains a loading shell; private identity data is fetched in the browser.
exports.onCreatePage = ({ page, actions }) => {
  if (page.path === "/dashboard/" && page.matchPath !== "/dashboard/*") {
    actions.createPage({ ...page, matchPath: "/dashboard/*" });
  }
  if (page.path === "/attendance/" && page.matchPath !== "/attendance/*") {
    actions.createPage({ ...page, matchPath: "/attendance/*" });
  }
};

const getEvents = async () => {
  if (!process.env.GATSBY_NOTION_TOKEN || !database_id) {
    console.warn("Notion token or database ID missing. Skipping event fetch.");
    return [];
  }
  const payload = {
    path: `databases/${database_id}/query`,
    method: "POST",
  };
  const { results } = await notion.request(payload);
  console.log(results);
  return results;
};

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;
  const typeDefs = `
    type GoogleSpreadsheetProjects implements Node {
      name: String
      description: String
      technologies: String
      github: String
      website: String
      year: String
      image: String
      awards: String
      repoLink: String
      projectYear: String
      videoLink: String
      teamMembers: String
    }
    type NotionEvent implements Node {
      content: NotionEventContent
    }
    type NotionEventContent {
      id: String
      properties: NotionEventProperties
    }
    type NotionEventProperties {
      Attendance: NotionNumber
      Date: NotionDate
      Description: NotionRichText
      Link: NotionUrl
      Name: NotionTitle
      Tags: NotionMultiSelect
      Time: NotionRichText
    }
    type NotionNumber {
      number: Int
    }
    type NotionDate {
      date: NotionDateObj
    }
    type NotionDateObj {
      start: String
      end: String
    }
    type NotionRichText {
      rich_text: [NotionTextObj]
    }
    type NotionTextObj {
      plain_text: String
    }
    type NotionUrl {
      url: String
    }
    type NotionTitle {
      title: [NotionTextObj]
    }
    type NotionMultiSelect {
      multi_select: [NotionSelectObj]
    }
    type NotionSelectObj {
      color: String
      name: String
    }
  `;
  createTypes(typeDefs);
};

exports.sourceNodes = async ({
  actions: { createNode },
  createNodeId,
  createContentDigest,
}) => {
  const events = await getEvents();
  events.forEach((event) => {
    const newNode = {
      content: { ...event },
      id: createNodeId(`NotionEvent-${event.id}`),
      internal: {
        type: "NotionEvent",
        contentDigest: createContentDigest(event),
      },
    };
    createNode(newNode);
  });
};

exports.onPostBuild = async ({ graphql, reporter }) => {
  const result = await graphql(`
    {
      site {
        siteMetadata {
          siteUrl
          url
        }
      }
      allSitePage {
        nodes {
          path
        }
      }
    }
  `);

  if (result.errors) {
    reporter.panicOnBuild("Failed to query pages for sitemap generation", result.errors);
    return;
  }

  const [{ collectSitemapUrls, renderSitemapXml }, { loadLeadershipData }, machineReadable] =
    await Promise.all([
      import("./src/lib/site/sitemap.mjs"),
      import("./src/lib/site/leadership.mjs"),
      import("./src/lib/site/machineReadable.mjs"),
    ]);

  const siteUrl =
    result.data?.site?.siteMetadata?.siteUrl ||
    result.data?.site?.siteMetadata?.url ||
    "https://pittcsc.org";
  const pagePaths = (result.data?.allSitePage?.nodes || []).map((node) => node.path);
  const sitemapUrls = collectSitemapUrls(siteUrl, pagePaths);
  const publicDir = path.join(__dirname, "public");

  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), renderSitemapXml(sitemapUrls), "utf8");

  const leadership = loadLeadershipData(__dirname);
  fs.writeFileSync(path.join(publicDir, "llms.txt"), machineReadable.buildLlmsTxt(), "utf8");
  fs.writeFileSync(
    path.join(publicDir, "llms-full.txt"),
    machineReadable.buildLlmsFullTxt(leadership),
    "utf8",
  );
  fs.writeFileSync(
    path.join(publicDir, "about.md"),
    machineReadable.buildAboutMarkdown(leadership),
    "utf8",
  );
  fs.writeFileSync(
    path.join(publicDir, "sponsors.md"),
    machineReadable.buildSponsorsMarkdown(),
    "utf8",
  );

  reporter.info(`Generated public/sitemap.xml with ${sitemapUrls.length} URLs and machine-readable summaries.`);
};
