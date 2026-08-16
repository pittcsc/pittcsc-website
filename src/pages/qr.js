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

const squareNavy = { color: NAVY, type: "square" };

// Base options shared by the preview and the download export. Error correction
// is forced to "H" (~30% recoverable) so the center logo never breaks
// scannability.
const baseOptions = {
  width: PREVIEW_SIZE,
  height: PREVIEW_SIZE,
  type: "canvas",
  image: logoUrl,
  margin: 16,
  qrOptions: { errorCorrectionLevel: "H" },
  dotsOptions: squareNavy,
  cornersSquareOptions: squareNavy,
  cornersDotOptions: squareNavy,
  backgroundOptions: { color: "#ffffff" },
  imageOptions: {
    margin: 0,
    hideBackgroundDots: true,
    imageSize: 0.35,
  },
};

const buttonBase =
  "rounded-lg px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

const QrPage = () => {
  const [link, setLink] = useState("");
  const previewRef = useRef(null);
  const qrRef = useRef(null);
  const lastDataRef = useRef(null);

  const qrData = link.trim() || FALLBACK_URL;
  const hasLink = link.trim().length > 0;

  // Instantiate the preview QR once, on the client only. qr-code-styling
  // needs the DOM/canvas, so it is dynamically imported inside useEffect to
  // keep Gatsby's server-side build from crashing.
  useEffect(() => {
    import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      qrRef.current = new QRCodeStyling({ ...baseOptions, data: FALLBACK_URL });
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
        qrRef.current.update({ data: qrData });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [qrData]);

  // Downloads render a throwaway full-resolution instance so the live preview
  // never pays export-size rasterization costs.
  const download = async (extension) => {
    const { default: QRCodeStyling } = await import("qr-code-styling");
    const exportQr = new QRCodeStyling({
      ...baseOptions,
      width: EXPORT_SIZE,
      height: EXPORT_SIZE,
      data: qrData,
    });
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

            <p className="mt-6 text-sm text-gray-500">
              Tip: PNG is best for slides and social posts, SVG for print.
              Always verify the final code with your phone.
            </p>
          </div>

          {/* Live preview */}
          <div className="flex flex-col items-center">
            <div
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-md"
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
