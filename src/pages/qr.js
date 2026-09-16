import React, { useEffect, useRef, useState } from "react";
import Layout from "../layouts/layout";
import logoUrl from "../images/qr-logo.png";

// PittCSC print-gamut navy — intentionally darker than the Tailwind `primary`;
// it matches the navy the logo is printed in on slides and newsletters.
const NAVY = "#1d2758";
const FALLBACK_URL = "https://pittcsc.org/";
const DOWNLOAD_NAME = "pittcsc-qr";
const PREVIEW_SIZE = 400;
const EXPORT_SIZE = 1000;
const MARGIN_SIZE = 16;

const squareNavy = { color: NAVY, type: "square" };

// Transparent by default, so an exported code drops onto a slide or poster of any
// colour without a white card around it. White is there for the times you *want*
// the card: a dark backdrop the navy would vanish into, a printer, or a tool that
// flattens alpha to black. rgba rather than the keyword because it is unambiguous
// in both the canvas preview and the SVG export.
const TRANSPARENT = "rgba(0,0,0,0)";
const WHITE = "#ffffff";
const backgroundFor = (white) => ({ color: white ? WHITE : TRANSPARENT });

// Base options shared by the preview and the download export. Error correction
// is forced to "H" (~30% recoverable) so the center logo never breaks
// scannability.
const baseOptions = {
  width: PREVIEW_SIZE,
  height: PREVIEW_SIZE,
  type: "canvas",
  image: logoUrl,
  margin: MARGIN_SIZE,
  qrOptions: { errorCorrectionLevel: "H" },
  dotsOptions: squareNavy,
  cornersSquareOptions: squareNavy,
  cornersDotOptions: squareNavy,
  backgroundOptions: backgroundFor(false),
  imageOptions: {
    margin: 0,
    hideBackgroundDots: true,
    imageSize: 0.45,
  },
};

const buttonBase =
  "rounded-lg px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

// Make a QRCode with the PittCSC logo in it and the correct data and size
// @data the data string to use
// @size the final image size, including the margins
// @white true for a plain white background, false for transparent
async function makeCode(data, size, white) {
  const { default: QRCodeStyling} = await import("qr-code-styling");
  // Make it twice, first approximating the image margin, and then calculating the exact size of one of the
  // squares and making that the margin. This is the first pass
  const code = new QRCodeStyling({
    ...baseOptions,
    width: size,
    height: size,
    data: data,
    backgroundOptions: backgroundFor(white),
  });
  // Calculate the exact margin and apply it
  const margin = (size - 2 * MARGIN_SIZE) / code._qr.getModuleCount();
  code.update({
    imageOptions: {
      margin: margin,
      hideBackgroundDots: true,
      imageSize: 0.45,
    }
  });
  return code;
}

// Do the double-update loop on an existing QRCode
async function updateCode(code, data, size) {
  code.update({data: data});
  const margin = (size - 2 * MARGIN_SIZE) / code._qr.getModuleCount();
  code.update({
    imageOptions: {
      margin: margin,
      hideBackgroundDots: true,
      imageSize: 0.45,
    }
  });
}

const QrPage = () => {
  const [link, setLink] = useState("");
  const [whiteBackground, setWhiteBackground] = useState(false);
  const previewRef = useRef(null);
  const qrRef = useRef(null);
  const lastDataRef = useRef(null);

  const qrData = link.trim() || FALLBACK_URL;
  const hasLink = link.trim().length > 0;

  // Instantiate the preview QR once, on the client only. qr-code-styling
  // needs the DOM/canvas, so it is dynamically imported inside useEffect to
  // keep Gatsby's server-side build from crashing.
  useEffect(() => {
    makeCode(FALLBACK_URL, PREVIEW_SIZE, false).then((code) => {
      qrRef.current = code;
      lastDataRef.current = FALLBACK_URL;
      if (previewRef.current) {
        previewRef.current.innerHTML = ""; // guard against double-mount appends
        qrRef.current.append(previewRef.current);
      }
    });
  }, []);

  // Re-render the preview when the link settles. Debounced so a typed URL
  // costs one or two renders instead of one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (qrRef.current && lastDataRef.current !== qrData) {
        lastDataRef.current = qrData;
        updateCode(qrRef.current, qrData, PREVIEW_SIZE);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [qrData]);

  // The background is a one-key update, so it needs none of the margin dance above.
  useEffect(() => {
    if (qrRef.current) {
      qrRef.current.update({ backgroundOptions: backgroundFor(whiteBackground) });
    }
  }, [whiteBackground]);

  // Downloads render a throwaway full-resolution instance so the live preview
  // never pays export-size rasterization costs.
  const download = async (extension) => {
    const exportQr = await makeCode(qrData, EXPORT_SIZE, whiteBackground);
    exportQr.download({ name: DOWNLOAD_NAME, extension });
  };

  return (
    <Layout title="QR Code Generator | Computer Science Club @ Pitt">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-primary md:text-5xl">
            QR Code Generator
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-gray-600">
            Paste a link and get a branded PittCSC QR code, ready to download.
          </p>
        </div>

        <div className="grid items-start gap-10 md:grid-cols-2">
          {/* Controls */}
          <div>
            <label
              htmlFor="qr-link"
              className="mb-2 block text-sm font-semibold text-primary"
            >
              Link
            </label>
            <input
              id="qr-link"
              type="url"
              inputMode="url"
              autoFocus
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://forms.gle/your-form"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-800 shadow-sm focus:border-primary focus:ring-primary"
            />

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => download("png")}
                disabled={!hasLink}
                className={`${buttonBase} bg-primary text-white shadow-sm hover:opacity-90`}
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={() => download("svg")}
                disabled={!hasLink}
                className={`${buttonBase} border-2 border-primary text-primary hover:bg-primary hover:text-white`}
              >
                Download SVG
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                id="qr-background"
                role="switch"
                aria-checked={whiteBackground}
                onClick={() => setWhiteBackground((v) => !v)}
                className={`relative h-6 w-11 flex-none rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  whiteBackground ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    whiteBackground ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <label htmlFor="qr-background" className="cursor-pointer text-sm text-gray-700">
                White background
              </label>
            </div>

            <p className="mt-4 text-sm text-gray-500">
              {whiteBackground
                ? "Exports on a plain white card, so it scans on any backdrop, including dark ones and tools that flatten transparency to black."
                : "Exports with a transparent background, so it sits on any colour. The code is dark navy, so keep it on a light backdrop or it won\u2019t scan."}{" "}
              Always check the final code with your phone.
            </p>
          </div>

          {/* Live preview */}
          <div className="flex flex-col items-center">
            <div
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 p-4 shadow-md"
              style={{
                // Checkerboard, not white: the code is transparent now, and against
                // a white card that would look identical to the old behaviour.
                backgroundImage:
                  "repeating-conic-gradient(#eef0f4 0% 25%, #ffffff 0% 50%)",
                backgroundSize: "16px 16px",
              }}
              aria-label="QR code preview"
            >
              <div ref={previewRef} className="[&>canvas]:h-auto [&>canvas]:w-full" />
            </div>
            {!hasLink && (
              <p className="mt-3 text-sm text-gray-400">
                Sample shown. Paste a link to create yours.
              </p>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default QrPage;
