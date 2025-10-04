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

  const keywordsQuery = campaign.keywords.join(" OR ");
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) return console.error("❌ Missing Twitter token");

  const twitterClient = new TwitterApi(bearerToken);

  const users = await User.find({}, "twitterId username avatar");
  const registeredUserMap = new Map(users.map(u => [u.twitterId, { username: u.username, avatar: u.avatar }]));

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


    const leaderboardMap: Record<string, { author_id: string; username: string; avatar: string; score: number }> = {};

    for (const tweet of allTweets) {
      const authorId = tweet.author_id;
      if (!authorId || !tweet.public_metrics) continue;

      const regUser = registeredUserMap.get(authorId);
      if (!regUser) continue;

      const userData = allUsers.find(u => u.id === authorId);
      const followersCount = userData?.public_metrics?.followers_count || 0;

      const score = scoreCreatorPost(
        { id: tweet.id!, text: tweet.text, created_at: tweet.created_at, public_metrics: tweet.public_metrics },
        followersCount
      );

      console.log("Ranked tweet:", {
        tweetId: tweet.id,
        author: regUser.username,
        text: tweet.text,
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

  leaderboardMap[authorId].score += score; // ✅ accumulate
}

    const leaderboard = Object.values(leaderboardMap).sort((a, b) => b.score - a.score);

    await Leaderboard.updateOne(
      { campaignId: new mongoose.Types.ObjectId(campaignId) },
      { $set: { data: leaderboard, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log(`✅ Leaderboard updated for ${campaignId}, entries: ${leaderboard.length}`);
  } catch (err) {
    console.error(`Error fetching leaderboard for ${campaignId}:`, err);
  }
}
