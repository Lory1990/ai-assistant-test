import { prisma } from "../../db/client.js";
import { env } from "../../config/env.js";

const GRAPH_API = "https://graph.facebook.com/v19.0";

// pages_manage_posts/instagram_content_publish richiedono che l'app passi la
// App Review di Meta prima di poter essere usate da altri utenti oltre agli
// sviluppatori/tester dell'app: in modalita' sviluppo funziona solo per il
// proprio account Meta, che e' comunque sufficiente per un progetto personale.
const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

function requireConfig() {
  if (!env.meta.appId || !env.meta.appSecret || !env.meta.redirectUri) {
    throw new Error(
      "Meta OAuth non configurato: imposta META_APP_ID, META_APP_SECRET, META_REDIRECT_URI in backend/.env " +
        "(crea l'app su https://developers.facebook.com/apps — redirect URI da registrare: " +
        `${env.meta.redirectUri ?? "<il tuo>/api/integrations/meta/callback"}).`,
    );
  }
}

export function getMetaAuthUrl(state: string): string {
  requireConfig();
  const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  url.searchParams.set("client_id", env.meta.appId!);
  url.searchParams.set("redirect_uri", env.meta.redirectUri!);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCodeForShortLivedToken(code: string): Promise<string> {
  const url = new URL(`${GRAPH_API}/oauth/access_token`);
  url.searchParams.set("client_id", env.meta.appId!);
  url.searchParams.set("client_secret", env.meta.appSecret!);
  url.searchParams.set("redirect_uri", env.meta.redirectUri!);
  url.searchParams.set("code", code);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Scambio codice Meta fallito: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  const url = new URL(`${GRAPH_API}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", env.meta.appId!);
  url.searchParams.set("client_secret", env.meta.appSecret!);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Rinnovo a long-lived token Meta fallito: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

/**
 * Scambia il code OAuth, recupera le Pagine Facebook gestite dall'utente e,
 * per ognuna, l'eventuale account Instagram Business collegato, salvando
 * tutto come SocialAccount. Va richiamato una volta per ogni nuovo
 * collegamento (o per rinnovare quando il long-lived token si avvicina alla
 * scadenza a ~60 giorni: Meta non offre un vero refresh token per gli utenti,
 * va ripetuto il login).
 */
export async function completeMetaConnection(userId: string, code: string): Promise<{ connected: string[] }> {
  requireConfig();
  const shortLivedToken = await exchangeCodeForShortLivedToken(code);
  const userToken = await exchangeForLongLivedToken(shortLivedToken);

  const pagesRes = await fetch(`${GRAPH_API}/me/accounts?access_token=${encodeURIComponent(userToken)}`);
  if (!pagesRes.ok) throw new Error(`Recupero pagine Facebook fallito: ${pagesRes.status} ${await pagesRes.text()}`);
  const { data: pages } = (await pagesRes.json()) as { data: FacebookPage[] };

  const connected: string[] = [];

  for (const page of pages) {
    await prisma.socialAccount.upsert({
      where: { userId_provider_externalId: { userId, provider: "facebook_page", externalId: page.id } },
      create: { userId, provider: "facebook_page", externalId: page.id, name: page.name, accessToken: page.access_token },
      update: { name: page.name, accessToken: page.access_token },
    });
    connected.push(`Facebook: ${page.name}`);

    const igRes = await fetch(
      `${GRAPH_API}/${page.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(page.access_token)}`,
    );
    if (!igRes.ok) continue; // pagina senza IG collegato o permesso mancante: si prosegue solo con Facebook
    const igData = (await igRes.json()) as { instagram_business_account?: { id: string; username: string } };
    const ig = igData.instagram_business_account;
    if (ig) {
      await prisma.socialAccount.upsert({
        where: { userId_provider_externalId: { userId, provider: "instagram", externalId: ig.id } },
        create: { userId, provider: "instagram", externalId: ig.id, name: ig.username, accessToken: page.access_token },
        update: { name: ig.username, accessToken: page.access_token },
      });
      connected.push(`Instagram: @${ig.username}`);
    }
  }

  return { connected };
}

export async function listSocialAccounts(userId: string) {
  return prisma.socialAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function disconnectSocialAccount(userId: string, accountId: string) {
  await prisma.socialAccount.deleteMany({ where: { id: accountId, userId } });
}
