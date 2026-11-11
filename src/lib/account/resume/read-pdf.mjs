const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 10;
const MAX_CHARACTERS = 150000;

// Keep coordinates until lines have been reconstructed. PDF text extraction
// order is not guaranteed to match visual reading order.
export function linesFromItems(items) {
  const rows = [];
  for (const item of items
    .filter((item) => item.str?.trim())
    .sort(
      (a, b) =>
        b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4],
    )) {
    const y = item.transform[5];
    let row = rows.find((entry) => Math.abs(entry.y - y) < 3);
    if (!row) rows.push((row = { y, items: [] }));
    row.items.push(item);
  }
  return rows
    .map(({ items }) => {
      let text = "";
      let right = -Infinity;
      for (const item of items.sort(
        (a, b) => a.transform[4] - b.transform[4],
      )) {
        const x = item.transform[4];
        // Preserve a wide horizontal gap (e.g. employer | city, title | dates)
        // instead of flattening both columns into one indistinguishable string.
        if (text && x - right > Math.max(32, Math.abs(item.transform[0]) * 3))
          text += " | ";
        else if (text && x - right > 1 && !text.endsWith(" ")) text += " ";
        text += item.str;
        right = x + item.width;
      }
      return text.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

export async function readResumePDF(
  blob,
  { signal, loadPDF = () => import("./pdf-browser.mjs") } = {},
) {
  if (!blob.size || blob.size > MAX_BYTES)
    throw new Error("Choose a resume PDF up to 10 MB.");
  signal?.throwIfAborted();
  const data = new Uint8Array(await blob.arrayBuffer());
  const { getDocument } = await loadPDF();
  signal?.throwIfAborted();
  const task = getDocument({
    data,
    isEvalSupported: false,
    stopAtErrors: true,
  });
  const abort = () => {
    void task.destroy();
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await task.promise;
    signal?.throwIfAborted();
    if (pdf.numPages > MAX_PAGES)
      throw new Error("Autofill supports resumes up to 10 pages.");
    const lines = [];
    const links = [];
    let characters = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      signal?.throwIfAborted();
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      characters += content.items.reduce(
        (sum, item) => sum + (item.str?.length || 0),
        0,
      );
      if (characters > MAX_CHARACTERS)
        throw new Error("This PDF contains too much text for autofill.");
      lines.push(...linesFromItems(content.items));
      for (const annotation of await page.getAnnotations()) {
        if (annotation.subtype === "Link" && annotation.url)
          links.push(annotation.url);
      }
      page.cleanup();
    }
    signal?.throwIfAborted();
    if (!lines.length)
      throw new Error(
        "No readable text found. Scanned resumes need manual entry.",
      );
    return { lines, links };
  } catch (error) {
    signal?.throwIfAborted();
    if (error.name === "PasswordException")
      throw new Error("Use a PDF without password protection for autofill.");
    if (["InvalidPDFException", "UnknownErrorException"].includes(error.name)) {
      throw new Error(
        "This PDF could not be read. Try another PDF or edit your profile manually.",
      );
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    await task.destroy();
  }
}
