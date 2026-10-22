import React, { useEffect, useState } from "react";

export default function MemberAvatar({ member, request, userID }) {
  const [url, setURL] = useState(null);
  useEffect(() => {
    if (!member.hasAvatar) {
      setURL(null);
      return undefined;
    }
    const controller = new AbortController();
    let objectURL;
    request(`/members/${member.id}/avatar`, {
      userID,
      signal: controller.signal,
      responseType: "blob",
    })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectURL = URL.createObjectURL(blob);
        setURL(objectURL);
      })
      .catch(() => {
        if (!controller.signal.aborted) setURL(null);
      });
    return () => {
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [member.id, member.hasAvatar, request, userID]);

  const initials = (member.name || "CSC member")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className="csc-member-avatar" aria-hidden="true">
      {url ? <img src={url} alt="" /> : initials}
    </span>
  );
}
