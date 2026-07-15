import type { EmailProvider, EmailSummary } from "./types.js";

/**
 * Stub Outlook provider via Microsoft Graph. Richiede un access token OAuth2
 * valido (scope Mail.Read) gia' ottenuto altrove (TODO: flusso OAuth con
 * MS_CLIENT_ID/SECRET/TENANT_ID da env).
 */
export class OutlookProvider implements EmailProvider {
  name = "outlook" as const;

  constructor(private accessToken: string) {}

  async listRecent(maxResults = 10): Promise<EmailSummary[]> {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=${maxResults}&$select=subject,from,receivedDateTime,bodyPreview`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    if (!res.ok) throw new Error(`Microsoft Graph API error: ${res.status}`);
    const { value } = (await res.json()) as { value: any[] };

    return value.map((m) => ({
      id: m.id,
      from: m.from?.emailAddress?.address ?? "?",
      subject: m.subject ?? "(nessun oggetto)",
      receivedAt: new Date(m.receivedDateTime),
      snippet: m.bodyPreview ?? "",
    }));
  }
}
