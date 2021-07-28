const dotenv = require("dotenv").config();
const { Client } = require("@notionhq/client");

const notion = new Client({
  auth: process.env.GATSBY_NOTION_TOKEN,
});

const database_id = process.env.GATSBY_NOTION_DATABASE_ID;

const getEvents = async () => {
  const payload = {
    path: `databases/${database_id}/query`,
    method: "POST",
  };
  const { results } = await notion.request(payload);
  console.log(results);
  return results;
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
