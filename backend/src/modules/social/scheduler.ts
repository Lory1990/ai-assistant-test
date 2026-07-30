import cron from "node-cron";
import { getDuePosts, publishPost } from "./index.js";

/** Ogni 5 minuti pubblica i SocialPost programmati la cui scadenza e' arrivata. */
export function startSocialPublishScheduler() {
  cron.schedule("*/5 * * * *", async () => {
    const duePosts = await getDuePosts(new Date());
    for (const post of duePosts) {
      try {
        await publishPost(post.id);
      } catch (err) {
        console.error(`Errore pubblicazione social post ${post.id}:`, err);
      }
    }
  });
}
