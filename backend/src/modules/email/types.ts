export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  receivedAt: Date;
  snippet: string;
}

export interface EmailProvider {
  name: "gmail" | "outlook";
  listRecent(maxResults?: number): Promise<EmailSummary[]>;
}
