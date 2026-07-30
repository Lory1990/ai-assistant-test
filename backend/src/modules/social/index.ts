import { prisma } from "../../db/client.js";
import { publicMediaUrl } from "./mediaStorage.js";

const GRAPH_API = "https://graph.facebook.com/v19.0";

export interface SchedulePostInput {
  userId: string;
  socialAccountId: string;
  content: string;
  scheduledAt: Date;
  mediaPath?: string;
}

export async function schedulePost(input: SchedulePostInput) {
  const account = await prisma.socialAccount.findFirst({ where: { id: input.socialAccountId, userId: input.userId } });
  if (!account) throw new Error("Account social non trovato.");
  if (account.provider === "instagram" && !input.mediaPath) {
    throw new Error("Instagram richiede sempre un'immagine: allega un file.");
  }

  return prisma.socialPost.create({
    data: {
      userId: input.userId,
      socialAccountId: input.socialAccountId,
      content: input.content,
      mediaPath: input.mediaPath,
      scheduledAt: input.scheduledAt,
    },
  });
}

export async function listPosts(userId: string) {
  return prisma.socialPost.findMany({
    where: { userId },
    include: { socialAccount: true },
    orderBy: { scheduledAt: "desc" },
  });
}

export async function cancelPost(userId: string, postId: string) {
  return prisma.socialPost.updateMany({
    where: { id: postId, userId, status: "pending" },
    data: { status: "canceled" },
  });
}

export async function getDuePosts(now: Date) {
  return prisma.socialPost.findMany({
    where: { status: "pending", scheduledAt: { lte: now } },
    include: { socialAccount: true },
  });
}

async function publishToFacebookPage(pageId: string, accessToken: string, content: string, imageUrl: string | null) {
  if (imageUrl) {
    const res = await fetch(`${GRAPH_API}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ url: imageUrl, caption: content, access_token: accessToken }),
    });
    if (!res.ok) throw new Error(`Pubblicazione foto Facebook fallita: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { post_id?: string; id: string };
    return data.post_id ?? data.id;
  }

  const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message: content, access_token: accessToken }),
  });
  if (!res.ok) throw new Error(`Pubblicazione Facebook fallita: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function publishToInstagram(igUserId: string, accessToken: string, content: string, imageUrl: string) {
  const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ image_url: imageUrl, caption: content, access_token: accessToken }),
  });
  if (!containerRes.ok) throw new Error(`Creazione media Instagram fallita: ${containerRes.status} ${await containerRes.text()}`);
  const { id: creationId } = (await containerRes.json()) as { id: string };

  const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: accessToken }),
  });
  if (!publishRes.ok) throw new Error(`Pubblicazione Instagram fallita: ${publishRes.status} ${await publishRes.text()}`);
  const { id: mediaId } = (await publishRes.json()) as { id: string };
  return mediaId;
}

/** Pubblica un post dovuto e ne aggiorna lo stato. Usata sia dallo scheduler cron sia da un eventuale "pubblica ora". */
export async function publishPost(postId: string): Promise<void> {
  const post = await prisma.socialPost.findUnique({ where: { id: postId }, include: { socialAccount: true } });
  if (!post || post.status !== "pending") return;

  const imageUrl = post.mediaPath ? publicMediaUrl(post.mediaPath) : null;
  if (post.mediaPath && !imageUrl) {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "failed", error: "PUBLIC_BASE_URL non configurato: impossibile generare un URL pubblico per l'immagine." },
    });
    return;
  }

  try {
    const externalPostId =
      post.socialAccount.provider === "instagram"
        ? await publishToInstagram(post.socialAccount.externalId, post.socialAccount.accessToken, post.content, imageUrl!)
        : await publishToFacebookPage(post.socialAccount.externalId, post.socialAccount.accessToken, post.content, imageUrl);

    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "published", externalPostId, publishedAt: new Date() },
    });
  } catch (err) {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "failed", error: (err as Error).message },
    });
  }
}
