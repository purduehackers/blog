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
    throw new Error(
      `Configure ${name} before using newsletter administration.`,
    );
  return value;
}
export function siteOrigin(): string {
  const url = new URL(required("NEWSLETTER_SITE_URL"));
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && url.hostname === "localhost")
  ) {
    throw new Error(
      "NEWSLETTER_SITE_URL must use HTTPS (or HTTP on localhost).",
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
