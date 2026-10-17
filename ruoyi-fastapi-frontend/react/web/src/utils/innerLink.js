export function innerLinkUrl(link, search = "") {
  try {
    const url = new URL(link);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    const query = new URLSearchParams(search);
    for (const key of new Set(query.keys())) {
      url.searchParams.delete(key);
      for (const value of query.getAll(key)) url.searchParams.append(key, value);
    }
    return url.href;
  } catch {
    return "";
  }
}
