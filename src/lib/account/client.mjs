export function createAccountClient({ getClient, apiURL, fetchImpl = fetch }) {
  return async function request(
    path,
    {
      userID,
      signal,
      method = "GET",
      body,
      contentType,
      responseType = "json",
    } = {},
  ) {
    if (!apiURL) throw new Error("Account service is not configured.");
    const sdk = await getClient();
    const assertSession = async () => {
      signal?.throwIfAborted();
      const { data, error } = await sdk.auth.getSession();
      if (error || !data.session || data.session.user.id !== userID) {
        throw new Error("Your session changed. Please sign in again.");
      }
      return data.session;
    };
    let session = await assertSession();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetchImpl(`${apiURL.replace(/\/$/, "")}${path}`, {
        method,
        body,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(contentType ? { "Content-Type": contentType } : {}),
        },
        cache: "no-store",
        credentials: "omit",
        signal,
      });
      if (response.status === 401 && attempt === 0) {
        await assertSession();
        const refreshed = await sdk.auth.refreshSession();
        if (refreshed.error)
          throw new Error(
            "Your session could not be refreshed. Please try again.",
          );
        session = await assertSession();
        continue;
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.error || "Your account could not be updated. Please try again.",
        );
      }
      const value =
        responseType === "empty"
          ? null
          : responseType === "blob"
            ? await response.blob()
            : await response.json();
      await assertSession();
      return value;
    }
    throw new Error("Please sign in again.");
  };
}
