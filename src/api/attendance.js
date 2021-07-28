const { Client } = require("@notionhq/client");

export default async function handler(req, res) {
  const notion = new Client({
    auth: process.env.GATSBY_NOTION_TOKEN,
  });

  try {
    const pageId = req.body.pageId;
    const attendance = req.body.attendance;
    const response = await notion.pages.update({
      page_id: pageId,
      properties: {
        Attendance: {
          number: attendance,
        },
      },
    });
    console.log(response);
    res.json(response);
  } catch (error) {
    res.status(500).send(error);
    console.log(error);
  }
}
