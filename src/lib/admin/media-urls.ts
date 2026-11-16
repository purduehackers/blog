// Imported media lives in the newsletter database. Resolve its URL at render
// time so a snapshot can be opened from a different host than the import.
export function newsletterMediaUrls(html: string, origin = ""): string {
  return html.replace(
    /(<(?:img|a)\b[^>]*?\s(?:src|href)=)(["'])(?:https?:\/\/[^/"'\s]+)?(\/api\/newsletter-media\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\2/gi,
    (_match, attribute, quote, path) => `${attribute}${quote}${origin}${path}${quote}`,
  );
}
