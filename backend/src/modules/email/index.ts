import type { EmailProvider } from "./types.js";

export * from "./types.js";
export { GmailProvider } from "./gmailProvider.js";
export { OutlookProvider } from "./outlookProvider.js";

export async function summarizeRecentEmails(provider: EmailProvider, maxResults = 10): Promise<string> {
  const emails = await provider.listRecent(maxResults);
  if (emails.length === 0) return "Nessuna email recente.";
  return emails.map((e) => `[${e.from}] ${e.subject} — ${e.snippet}`).join("\n");
}
