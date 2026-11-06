export function isSecurePointURL(raw) {
  const value = raw.trim();
  if (
    value.length === 0 ||
    value.length > 2048 ||
    /[\u0000\r\n\t ]/.test(value)
  ) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname;
    const isIPAddress =
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      hostname !== "" &&
      !isIPAddress &&
      !hostname.endsWith(".") &&
      (parsed.port === "" || parsed.port === "443")
    );
  } catch {
    return false;
  }
}
