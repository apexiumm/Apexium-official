// lib/startCampaignStream.ts
import { TwitterApi, TweetV2 } from "twitter-api-v2";
import mongoose from "mongoose";
import { Campaign } from "@/models/Campaign";
import { User } from "@/models/User";
import { Leaderboard } from "@/models/Leaderboard";
import { connectToDB } from "@/lib/mongodb";
import { scoreCreatorPost } from "@/lib/apex-academia-scoring";
export async function startCampaignStream(campaignId: string) {
  console.log(`🚀 startCampaignStream triggered for campaign ${campaignId}`);

  await connectToDB();
  console.log("🗄 Connected to MongoDB");

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    console.warn(`⚠ Campaign ${campaignId} not found`);
    return;
  }

  if (!campaign.keywords || campaign.keywords.length === 0) {
    console.warn(`⚠ Campaign ${campaignId} has no keywords`);
    return;
  }

  console.log(`🔑 Campaign keywords: ${campaign.keywords.join(", ")}`);

  const keywordsQuery = campaign.keywords.join(" OR ");
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) return console.error("❌ Missing Twitter token");

  const twitterClient = new TwitterApi(bearerToken);
  console.log("🐦 Twitter client initialized");

  let registeredUserMap = new Map<string, { username: string; avatar: string }>();

  const refreshRegisteredUsers = async () => {
    console.log("🔄 Refreshing registered users...");
    const users = await User.find({}, "twitterId username avatar");
    registeredUserMap = new Map(
      users.map((u) => [u.twitterId, { username: u.username, avatar: u.avatar }])
    );
    console.log(`✅ Refreshed users: ${registeredUserMap.size} total`);
  };

  await refreshRegisteredUsers();

  const fetchAndUpdateLeaderboard = async () => {
    try {
      console.log(`🔍 Searching Twitter for campaign ${campaignId}...`);

      const paginator = await twitterClient.v2.search(keywordsQuery, {
        "tweet.fields": ["public_metrics", "author_id", "text", "created_at"],
        expansions: ["author_id", "referenced_tweets.id"],
        "user.fields": ["username", "profile_image_url", "public_metrics"],
        max_results: 100,
      });

      console.log("📄 Twitter search returned, fetching pages...");

      const allTweets: TweetV2[] = [];
      const allUsers: { id: string; username: string; profile_image_url?: string; public_metrics?: any }[] = [];

      let pageCount = 0;
      do {
        const realData = (paginator as any)._realData;
        allTweets.push(...(realData?.data || []));
        allUsers.push(...(realData?.includes?.users || []));
        pageCount++;
        console.log(`📄 Page ${pageCount} fetched, tweets so far: ${allTweets.length}`);
        if (pageCount >= 5) break;
      } while (await paginator.fetchNext());

      console.log(`✅ Total tweets fetched: ${allTweets.length}, users: ${allUsers.length}`);

      // Build leaderboard
      const leaderboardMap: Record<string, { author_id: string; username: string; avatar: string; score: number }> = {};

      for (const tweet of allTweets) {
        const authorId = tweet.author_id;
        const metrics = tweet.public_metrics;
        if (!authorId || !metrics) continue;

        const regUser = registeredUserMap.get(authorId);
        if (!regUser) continue;

        const userData = allUsers.find((u) => u.id === authorId);
        const followersCount = userData?.public_metrics?.followers_count || 0;
        const score = scoreCreatorPost(
          { id: tweet.id!, text: tweet.text, created_at: tweet.created_at, public_metrics: tweet.public_metrics },
          followersCount
        );

        leaderboardMap[authorId] = {
          author_id: authorId,
          username: regUser.username || userData?.username || "Unknown",
          avatar: regUser.avatar || userData?.profile_image_url || "/avatar1.png",
          score,
        };
      }

      const leaderboard = Object.values(leaderboardMap).sort((a, b) => b.score - a.score);

      await Leaderboard.updateOne(
        { campaignId: new mongoose.Types.ObjectId(campaignId) },
        { $set: { data: leaderboard, updatedAt: new Date() } },
        { upsert: true }
      );

      console.log(`🏆 Leaderboard updated for campaign ${campaignId}, entries: ${leaderboard.length}`);
    } catch (err) {
      console.error(`❌ Error fetching leaderboard for ${campaignId}:`, err);
    }
  };

  // Run once immediately
  await fetchAndUpdateLeaderboard();

  // Intervals
  console.log("⏱ Setting intervals for leaderboard and user refresh (only works if process keeps running)");
  setInterval(fetchAndUpdateLeaderboard, 20 * 1000); // every 20s (for testing)
  setInterval(refreshRegisteredUsers, 20 * 1000); // every 20s (for testing)
}