const dotenv = require("dotenv").config();
const { Client } = require("@notionhq/client");

const notion = new Client({
  auth: process.env.GATSBY_NOTION_TOKEN,
});

const database_id = process.env.GATSBY_NOTION_DATABASE_ID;

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
