// Public application identifiers; no client secret is used by device-code login.
const defaults = {
  MICROSOFT_CLIENT_ID: "4f57124f-5363-4ecb-9332-15f5b9f36609",
  MICROSOFT_TENANT_ID: "4130bd39-7c53-419c-b1e5-8758d6d63f21",
};
export function required(name) {
  const value = process.env[name]?.trim() || defaults[name];
  if (!value) throw new Error(`Set ${name} in .env. See README.md.`);
  return value;
}
