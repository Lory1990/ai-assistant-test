import type { EmailProvider, EmailSummary } from "./types.js";

/**
 * Stub Gmail provider. Richiede un access token OAuth2 valido (scope
 * https://www.googleapis.com/auth/gmail.readonly) gia' ottenuto e refreshato
 * altrove (TODO: flusso OAuth completo con GOOGLE_CLIENT_ID/SECRET da env).
 */
export class GmailProvider implements EmailProvider {
  name = "gmail" as const;

  constructor(private accessToken: string) {}

  async listRecent(maxResults = 10): Promise<EmailSummary[]> {
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    if (!listRes.ok) throw new Error(`Gmail API error: ${listRes.status}`);
    const { messages } = (await listRes.json()) as { messages?: { id: string }[] };
    if (!messages?.length) return [];

    const details = await Promise.all(
      messages.map(async (m) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: `Bearer ${this.accessToken}` } },
        );
        const data = (await res.json()) as any;
        const headers: { name: string; value: string }[] = data?.payload?.headers ?? [];
        const from = headers.find((h) => h.name === "From")?.value ?? "?";
        const subject = headers.find((h) => h.name === "Subject")?.value ?? "(nessun oggetto)";
        return {
          id: m.id,
          from,
          subject,
          receivedAt: new Date(Number(data?.internalDate ?? Date.now())),
          snippet: data?.snippet ?? "",
        } satisfies EmailSummary;
      }),
    );

    return details;
  }
}
