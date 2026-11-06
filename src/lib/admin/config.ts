// Only deliberately safe setup messages are shown by the admin error handler.
export class AdminSetupError extends Error {}

export function setting(name: string, fallback = ""): string {
  return (
    process.env[name] ||
    (import.meta.env?.[name] as string | undefined) ||
    fallback
  );
}
export function required(name: string): string {
  const value = setting(name);
  if (!value)
    throw new AdminSetupError(
      `Configure ${name} before using newsletter administration.`,
    );
  return value;
}
export function siteOrigin(): string {
  let url: URL;
  try {
    url = new URL(required("NEWSLETTER_SITE_URL"));
  } catch (error) {
    if (error instanceof AdminSetupError) throw error;
    throw new AdminSetupError(
      "Set NEWSLETTER_SITE_URL to a complete URL, such as http://localhost:3000 locally or https://blog.purduehackers.com in production.",
    );
  }
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && url.hostname === "localhost")
  ) {
    throw new AdminSetupError(
      "Set NEWSLETTER_SITE_URL to an HTTPS URL, or http://localhost:3000 for local development.",
    );
  }
  return url.origin;
}
export function sender(): string {
  const email = setting(
    "MICROSOFT_SENDER_EMAIL",
    "phackers@purdue.edu",
  ).toLowerCase();
  if (!/^[^\s@]+@purdue\.edu$/.test(email))
    throw new Error("The sender must be a purdue.edu mailbox.");
  return email;
}
