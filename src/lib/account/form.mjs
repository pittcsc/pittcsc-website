export function formFromProfile(profile) {
  return {
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    preferredName: profile.preferredName || "",
    graduationYear: profile.graduationYear?.toString() || "",
    majors: profile.majors?.length ? [...profile.majors] : [""],
  };
}

export function profileInput(form) {
  const name = (value) => {
    const trimmed = value.trim();
    if ([...trimmed].length > 100 || /[\0\r\n]/.test(trimmed))
      throw new Error("Names must be at most 100 characters.");
    return trimmed || null;
  };
  const year = form.graduationYear.trim();
  if (
    year &&
    (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100)
  ) {
    throw new Error(
      "Enter a graduation year between 1900 and 2100, or leave it blank for now.",
    );
  }
  const majors = form.majors.map((value) => value.trim()).filter(Boolean);
  if (
    majors.length > 8 ||
    majors.some((value) => [...value].length > 120 || /[\0\r\n]/.test(value))
  ) {
    throw new Error("Add up to eight majors, each at most 120 characters.");
  }
  if (
    new Set(majors.map((value) => value.toLowerCase())).size !== majors.length
  ) {
    throw new Error("Each major should appear only once.");
  }
  return {
    firstName: name(form.firstName),
    lastName: name(form.lastName),
    preferredName: name(form.preferredName),
    graduationYear: year ? Number(year) : null,
    majors,
  };
}

export function initials(profile) {
  return (
    [profile.preferredName || profile.firstName, profile.lastName]
      .filter(Boolean)
      .map((value) => [...value.trim()][0] || "")
      .join("")
      .toUpperCase() || "?"
  );
}
