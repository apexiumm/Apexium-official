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
  if (!campaign) return console.warn(`⚠️ Campaign ${campaignId} not found`);

  if (!campaign.keywords?.length)
    return console.warn(`⚠️ Campaign ${campaignId} has no keywords`);

  const keywordsQuery = `(${campaign.keywords.join(" OR ")})`;
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) return console.error("❌ Missing Twitter token");

  const twitterClient = new TwitterApi(bearerToken);

  // 🧩 Get all registered users
  const users = await User.find({}, "twitterId username avatar");
  if (!users.length) return console.warn("⚠️ No registered users found");

  const registeredUserMap = new Map(
    users.map((u) => [u.twitterId, { username: u.username, avatar: u.avatar }])
  );

  try {
    console.log(`🔍 Searching Twitter for campaign ${campaignId} (safe batching)...`);

    const maxUsersPerBatch = 10; // safer: only 10–12 users per query
    const maxQueryLength = 460;

    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentLength = 0;

    for (const user of users) {
      const clause = `from:${user.username}`;
      const addedLength = clause.length + 5;
      if (
        currentBatch.length >= maxUsersPerBatch ||
        currentLength + addedLength > maxQueryLength
      ) {
        batches.push(currentBatch);
        currentBatch = [];
        currentLength = 0;
      }
      currentBatch.push(clause);
      currentLength += addedLength;
    }
    if (currentBatch.length) batches.push(currentBatch);

    console.log(`🧩 Total users: ${users.length}, total batches: ${batches.length}`);

    const allTweets: TweetV2[] = [];
    const allUsers: {
      id: string;
      username: string;
      profile_image_url?: string;
      public_metrics?: any;
    }[] = [];

    // 🔁 Fetch each batch
    for (let i = 0; i < batches.length; i++) {
      const fromQuery = `(${batches[i].join(" OR ")}) ${keywordsQuery}`;
      console.log(`🔎 Batch ${i + 1}/${batches.length}: ${fromQuery.length} chars`);

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
          const usersIncluded = realData?.includes?.users || [];

          allTweets.push(...tweets);
          allUsers.push(...usersIncluded);

          pageCount++;
          console.log(
            `📄 Batch ${i + 1} → Page ${pageCount} fetched (total tweets so far: ${allTweets.length})`
          );

          if (pageCount >= 5) break; // prevent abuse
        } while (await paginator.fetchNext());
      } catch (err) {
        if (err instanceof Error) {
          console.warn(`⚠️ Batch ${i + 1}/${batches.length} failed: ${err.message}`);
        } else {
          console.warn(`⚠️ Batch ${i + 1}/${batches.length} failed with unknown error:`, err);
        }
        continue;
      }
    }

    // 🔎 Post-filter only registered users
    const filteredTweets = allTweets.filter((t) => registeredUserMap.has(t.author_id!));
    console.log(
      `✅ Filtered tweets: ${filteredTweets.length} of ${allTweets.length} (only registered users)`
    );

    // 🧮 Ranking logic
    const leaderboardMap: Record<
      string,
      { author_id: string; username: string; avatar: string; score: number }
    > = {};

    for (const tweet of filteredTweets) {
      const authorId = tweet.author_id;
      if (!authorId || !tweet.public_metrics) continue;

      const regUser = registeredUserMap.get(authorId);
      if (!regUser) continue;

      const userData = allUsers.find((u) => u.id === authorId);
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

      console.log("Ranked tweet:", {
        tweetId: tweet.id,
        author: regUser.username,
        score,
        likes: tweet.public_metrics.like_count,
        retweets: tweet.public_metrics.retweet_count,
        replies: tweet.public_metrics.reply_count,
      });

      if (!leaderboardMap[authorId]) {
        leaderboardMap[authorId] = {
          author_id: authorId,
          username: regUser.username || userData?.username || "Unknown",
          avatar: regUser.avatar || userData?.profile_image_url || "/avatar1.png",
          score: 0,
        };
      }

      leaderboardMap[authorId].score += score;
    }

    const leaderboard = Object.values(leaderboardMap).sort((a, b) => b.score - a.score);

    await Leaderboard.updateOne(
      { campaignId: new mongoose.Types.ObjectId(campaignId) },
      { $set: { data: leaderboard, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log(`✅ Leaderboard updated for ${campaignId}, entries: ${leaderboard.length}`);
  } catch (err) {
    console.error(`❌ Fatal error fetching leaderboard for ${campaignId}:`, err);
  }
}
