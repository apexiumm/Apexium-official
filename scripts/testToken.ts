import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';

async function main() {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    console.error("❌ Missing X_BEARER_TOKEN in your environment.");
    process.exit(1);
  }

  const client = new TwitterApi(bearerToken);

  try {
    // App-only safe endpoint: search recent tweets
    const result = await client.v2.search("test", { max_results: 1 });
    console.log("✅ App-only token works! Meta info:", result.meta);
  } catch (err: any) {
    if (err?.code === 401 || err?.code === 403) {
      console.error("❌ Token invalid or insufficient permissions:", err.data || err.message);
    } else {
      console.error("⚠️ Unexpected error:", err);
    }
  }
}

main();

