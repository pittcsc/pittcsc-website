const { Client } = require("@notionhq/client");

export default async function handler(req, res) {
  try {
    const notion = new Client({
      auth: process.env.GATSBY_NOTION_TOKEN,
    });
    console.log(req.body);
    const pageId = req.body.pageId;
    const getPage = await notion.pages.retrieve({ page_id: pageId });
    const attendance = getPage.properties.Attendance.number
      ? getPage.properties.Attendance.number + parseInt(req.body.add)
      : 1;
    console.log(attendance);
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
    // res.status(200).json({ hello: `world` });
  } catch (error) {
    res.status(500).send(error);
    console.log(error);
  }
}
