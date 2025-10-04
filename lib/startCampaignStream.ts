// lib/startCampaignStream.ts
import { TwitterApi, TweetV2 } from "twitter-api-v2";
import mongoose from "mongoose";
import { Campaign } from "@/models/Campaign";
import { User } from "@/models/User";
import { Leaderboard } from "@/models/Leaderboard";
import { connectToDB } from "@/lib/mongodb";
import { scoreCreatorPost } from "@/lib/apex-academia-scoring";

export async function startCampaignStream(campaignId: string) {
  await connectToDB();

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    console.warn(`⚠️ Campaign ${campaignId} not found`);
    return;
  }

  if (!campaign.keywords || campaign.keywords.length === 0) {
    console.warn(`⚠️ Campaign ${campaignId} has no keywords`);
    return;
  }

  const keywordsQuery = `(${campaign.keywords.join(" OR ")})`;
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) return console.error("❌ Missing Twitter token");

  const twitterClient = new TwitterApi(bearerToken);

  // 🧩 Get all registered users
  const users = await User.find({}, "twitterId username avatar");
  if (!users.length) {
    console.warn("⚠️ No registered users found");
    return;
  }

  const registeredUserMap = new Map(
    users.map((u) => [u.twitterId, { username: u.username, avatar: u.avatar }])
  );

  console.log(
    `🔍 Searching Twitter for campaign ${campaignId} — per-user fetch mode enabled`
  );

  const allTweets: TweetV2[] = [];
  const allUsers: any[] = [];
  const leaderboardMap: Record<
    string,
    { author_id: string; username: string; avatar: string; score: number }
  > = {};

  // 🔁 Fetch tweets for each registered user only
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const fromQuery = `from:${user.username} ${keywordsQuery}`;

    console.log(`👤 Fetching tweets for user ${i + 1}/${users.length}: ${user.username}`);

    try {
      const paginator = await twitterClient.v2.search(fromQuery, {
        "tweet.fields": ["public_metrics", "author_id", "text", "created_at"],
        expansions: ["author_id", "referenced_tweets.id"],
        "user.fields": ["username", "profile_image_url", "public_metrics"],
        max_results: 100,
      });

      let pageCount = 0;
      do {
        const realData = (paginator as any)._realData;
        const tweets = realData?.data || [];
        const userData = realData?.includes?.users?.[0];

        if (tweets.length > 0) {
          allTweets.push(...tweets);
          if (userData) allUsers.push(userData);

          for (const tweet of tweets) {
            const authorId = tweet.author_id;
            if (!authorId || !tweet.public_metrics) continue;

            const regUser = registeredUserMap.get(authorId);
            if (!regUser) continue;

            const followersCount = userData?.public_metrics?.followers_count || 0;
            const score = scoreCreatorPost(
              {
                id: tweet.id!,
                text: tweet.text,
                created_at: tweet.created_at,
                public_metrics: tweet.public_metrics,
              },
              followersCount
            );

            if (!leaderboardMap[authorId]) {
              leaderboardMap[authorId] = {
                author_id: authorId,
                username: regUser.username || userData?.username || "Unknown",
                avatar:
                  regUser.avatar || userData?.profile_image_url || "/avatar1.png",
                score: 0,
              };
            }

            leaderboardMap[authorId].score += score;

            console.log(`⭐ Scored tweet by ${regUser.username}: +${score}`);
          }
        }

        pageCount++;
        if (pageCount >= 3) break; // limit pages per user
      } while (await paginator.fetchNext());

    } catch (err) {
      if (err instanceof Error) {
        console.warn(`⚠️ Failed to fetch tweets for ${user.username}: ${err.message}`);
      } else {
        console.warn(`⚠️ Unknown error fetching ${user.username}:`, err);
      }
      continue; // skip to next user
    }
  }

  console.log(
    `✅ Total tweets fetched: ${allTweets.length} (from ${users.length} users)`
  );

  // 🧮 Sort and save leaderboard
  const leaderboard = Object.values(leaderboardMap).sort((a, b) => b.score - a.score);

  await Leaderboard.updateOne(
    { campaignId: new mongoose.Types.ObjectId(campaignId) },
    { $set: { data: leaderboard, updatedAt: new Date() } },
    { upsert: true }
  );

  console.log(
    `🏁 Leaderboard updated for ${campaignId}, entries: ${leaderboard.length}`
  );
}
