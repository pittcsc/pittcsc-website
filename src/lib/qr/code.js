import logoUrl from "../../images/qr-logo.png";

const NAVY = "#1d2758";
const MARGIN_SIZE = 16;
const TRANSPARENT = "rgba(0,0,0,0)";
const WHITE = "#ffffff";
const squareNavy = { color: NAVY, type: "square" };
const backgroundFor = (white) => ({ color: white ? WHITE : TRANSPARENT });

export const PREVIEW_SIZE = 400;
export const EXPORT_SIZE = 1000;

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

export async function makeCode(data, size, white) {
  const { default: QRCodeStyling } = await import("qr-code-styling");
  const code = new QRCodeStyling({
    ...baseOptions,
    width: size,
    height: size,
    data,
    backgroundOptions: backgroundFor(white),
  });
  const margin = (size - 2 * MARGIN_SIZE) / code._qr.getModuleCount();
  code.update({
    imageOptions: { margin, hideBackgroundDots: true, imageSize: 0.45 },
  });
  return code;
}

export function updateCode(code, data, size) {
  code.update({ data });
  const margin = (size - 2 * MARGIN_SIZE) / code._qr.getModuleCount();
  code.update({
    imageOptions: { margin, hideBackgroundDots: true, imageSize: 0.45 },
  });
}

export function setWhiteBackground(code, white) {
  code.update({ backgroundOptions: backgroundFor(white) });
}
