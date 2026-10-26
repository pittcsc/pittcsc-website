import React, { useEffect, useState } from "react";
export default function ProtectedPhoto({
  id,
  name,
  request,
  userID,
  updatedAt,
}) {
  const [url, setURL] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let objectURL;
    setURL("");
    request(`/alumni/${id}/photo`, {
      userID,
      signal: controller.signal,
      responseType: "blob",
    })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectURL = URL.createObjectURL(blob);
        setURL(objectURL);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [id, request, userID, updatedAt]);
  return url ? (
    <img src={url} alt={name} className="w-full h-full object-cover" />
  ) : (
    <span
      aria-label={`${name}'s photo unavailable`}
      className="w-full h-full bg-gradient-pitt flex items-center justify-center text-white"
    >
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}
