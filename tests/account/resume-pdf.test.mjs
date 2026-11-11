import test from "node:test";
import assert from "node:assert/strict";
import {
  linesFromItems,
  readResumePDF,
} from "../../src/lib/account/resume/read-pdf.mjs";

const item = (str, x, y, width = str.length * 5) => ({
  str,
  transform: [1, 0, 0, 1, x, y],
  width,
});
test("PDF fragments are ordered visually and adjacent URL fragments remain connected", () => {
  assert.deepEqual(
    linesFromItems([
      item("Science", 80, 70),
      item("Jordan Lee", 10, 100),
      item("github.com/", 10, 85),
      item("jlee", 65, 85),
      item("Computer", 10, 70),
    ]),
    ["Jordan Lee", "github.com/jlee", "Computer Science"],
  );
});

function loader({
  pages = 1,
  items = [item("Jordan Lee", 0, 100)],
  failure,
} = {}) {
  let destroyed = false;
  return {
    loadPDF: async () => ({
      getDocument: () => ({
        promise: failure
          ? Promise.reject(failure)
          : Promise.resolve({
              numPages: pages,
              getPage: async () => ({
                getTextContent: async () => ({ items }),
                getAnnotations: async () => [
                  { subtype: "Link", url: "https://github.com/jlee" },
                ],
                cleanup() {},
              }),
            }),
        destroy: async () => {
          destroyed = true;
        },
      }),
    }),
    destroyed: () => destroyed,
  };
}
test("reads text and hyperlink annotations and releases the PDF", async () => {
  const fixture = loader();
  assert.deepEqual(await readResumePDF(new Blob(["pdf"]), fixture), {
    lines: ["Jordan Lee"],
    links: ["https://github.com/jlee"],
  });
  assert.equal(fixture.destroyed(), true);
});
test("rejects oversized, scanned, protected, and overlong PDFs", async () => {
  await assert.rejects(
    readResumePDF(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)])),
    /10 MB/,
  );
  for (const [options, message] of [
    [{ pages: 11 }, /10 pages/],
    [{ items: [] }, /Scanned/],
    [
      { failure: Object.assign(new Error(), { name: "PasswordException" }) },
      /password/,
    ],
    [
      { failure: Object.assign(new Error(), { name: "InvalidPDFException" }) },
      /could not be read/,
    ],
  ]) {
    const fixture = loader(options);
    await assert.rejects(readResumePDF(new Blob(["pdf"]), fixture), message);
    assert.equal(fixture.destroyed(), true);
  }
});
test("an aborted request never loads a PDF", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    readResumePDF(new Blob(["pdf"]), {
      signal: controller.signal,
      loadPDF: () => assert.fail("must not load"),
    }),
    { name: "AbortError" },
  );
});

test("extracts a real text PDF with PDF.js", async () => {
  const stream =
    "BT /F1 16 Tf 50 750 Td (Jordan Lee) Tj 0 -24 Td (Computer Science) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const result = await readResumePDF(new Blob([pdf]), {
    loadPDF: () => import("pdfjs-dist/legacy/build/pdf.mjs"),
  });
  assert.deepEqual(result.lines, ["Jordan Lee", "Computer Science"]);
});
