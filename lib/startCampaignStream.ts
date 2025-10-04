// lib/startCampaignStream.ts
import { TwitterApi } from "twitter-api-v2";
import mongoose, { Schema, model, models } from "mongoose";
import { Campaign } from "@/models/Campaign";
import { User } from "@/models/User";
import { Leaderboard } from "@/models/Leaderboard";
import { connectToDB } from "@/lib/mongodb";
import { scoreCreatorPost } from "@/lib/apex-academia-scoring";

type TrackedTweetDoc = {
  tweetId: string;
  authorId: string;
  username: string;
  avatar?: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  lastScore: number;
  refreshStage: number;
  nextRefreshAt: Date | null;
  campaignId: mongoose.Types.ObjectId;
};



/**
 * WHAT THIS FILE PROVIDES
 * - startCampaignStream(campaignId): detects NEW tweets for a tiny batch of users,
 *   scores them, stores them for later hydration, and MERGES the points into the leaderboard.
 * - refreshTweetMetrics(campaignId): re-fetches stored tweets' metrics over 72h and adds
 *   ONLY the extra points to the leaderboard (no double counting).
 *
 * Serverless-safe: each function uses ~7s soft budget to stay under Vercel Free 10s.
 * Basic API-safe: per-user timelines, sinceId, small pages, adaptive backoff, 100-ID hydration.
 */

/* -------------------- Minimal TrackedTweet model -------------------- */
/** Tracks every matched tweet for 72h hydration.
 *  Unique on (campaignId, tweetId) so we never duplicate. */
const TrackedTweetSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, required: true, index: true },
    tweetId: { type: String, required: true, index: true },
    authorId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    avatar: { type: String },
    public_metrics: {
      like_count: { type: Number, default: 0 },
      retweet_count: { type: Number, default: 0 },
      reply_count: { type: Number, default: 0 },
      quote_count: { type: Number, default: 0 },
    },
    lastScore: { type: Number, default: 0 }, // last computed score snapshot
    refreshStage: { type: Number, default: 0 }, // 0..REFRESH_OFFSETS.length
    nextRefreshAt: { type: Date, index: true, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
TrackedTweetSchema.index({ campaignId: 1, tweetId: 1 }, { unique: true });
const TrackedTweet =
  (models as any).TrackedTweet || model("TrackedTweet", TrackedTweetSchema);

/* ----------------------- Tunables (poller) ----------------------- */
const SOFT_BUDGET_MS = 7000; // stay under Vercel Free 10s
const MAX_USERS_PER_RUN = 5; // tiny batch per invocation
const MAX_RESULTS = 60; // smaller than 100 to reduce reads
const TWEET_FIELDS = "public_metrics,author_id,text,created_at"; // slim payload
const USE_ROLLING_WINDOW = true; // safety: bound lookback
const ROLLING_DAYS = 3; // do not walk older than 3 days

// Adaptive poll intervals (quiet users polled less often)
const ACTIVE_BACKOFF_MS = 5 * 60 * 1000; // 5 min if matched tweets
const QUIET_BACKOFF_MS = 45 * 60 * 1000; // 45 min if none matched

/* ---------------------- Tunables (hydrator) ---------------------- */
const HYDRATE_SOFT_BUDGET_MS = 7000;
const HYDRATE_BATCH_TWEETS = 100; // /2/tweets?ids=... max
// 72-hour ladder: 15m → 2h → 12h → 48h → 72h (final pass)
const REFRESH_OFFSETS = [
  15 * 60 * 1000, // 15m
  2 * 60 * 60 * 1000, // 2h
  12 * 60 * 60 * 1000, // 12h
  48 * 60 * 60 * 1000, // 48h
  72 * 60 * 60 * 1000, // 72h
];

/* -------------------------- Helpers -------------------------- */
function nowIsoMinusDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function normalize(text = "") {
  return text.normalize("NFKC").toLowerCase();
}
function buildKeywordMatchers(keys: string[]) {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return keys.map((k) => {
    const v = esc(k.toLowerCase());
    if (k.startsWith("$") || k.startsWith("@") || k.startsWith("#")) {
      return new RegExp(`(^|\\W)${v}($|\\W)`, "i"); // token-guarded
    }
    return new RegExp(`\\b${v}\\b`, "i");
  });
}
function matchesAny(text: string, regs: RegExp[]) {
  const t = normalize(text);
  for (const r of regs) if (r.test(t)) return true;
  return false;
}

/* ======================= NEW-TWEET POLLER ======================= */
export async function startCampaignStream(campaignId: string) {
  const started = Date.now();
  const timeLeft = () => SOFT_BUDGET_MS - (Date.now() - started);
  const ensureTime = (reserve = 250) => {
    if (timeLeft() < reserve) throw new Error("⏱ Time budget reached");
  };

  await connectToDB();
  ensureTime();

  const campaign = await Campaign.findById(campaignId).lean();
  if (!campaign?.keywords?.length) {
    console.warn(`⚠ Campaign ${campaignId} missing or has no keywords`);
    return;
  }
  const matchers = buildKeywordMatchers(campaign.keywords);

  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.error("❌ Missing X_BEARER_TOKEN");
    return;
  }
  const twitter = new TwitterApi(token);

  // Pick a tiny batch of users that are due (based on nextPollAt / lastPolledAt)
  const now = new Date();
  const users = await User.find(
    {
      enabled: { $ne: false },
      $or: [{ nextPollAt: { $lte: now } }, { nextPollAt: { $exists: false } }],
    },
    "twitterId username avatar sinceId lastPolledAt nextPollAt"
  )
    .sort({ lastPolledAt: 1, _id: 1 })
    .limit(MAX_USERS_PER_RUN)
    .lean();

  if (!users.length) {
    console.warn("⚠ No registered users ready for polling");
    return;
  }

  // Accumulate only THIS RUN's points; we'll merge into totals at end.
  const deltaMap: Record<
    string,
    { author_id: string; username: string; avatar: string; score: number }
  > = {};

  for (const u of users) {
    ensureTime(600);
    try {
      const params: Record<string, any> = {
        max_results: MAX_RESULTS,
        "tweet.fields": TWEET_FIELDS,
      };
      if (u.sinceId) params.since_id = u.sinceId;
      if (USE_ROLLING_WINDOW) params.start_time = nowIsoMinusDays(ROLLING_DAYS);

      const tl = await twitter.v2.userTimeline(u.twitterId, params);
      const tweets = tl.data?.data ?? [];

      let newest: string | null = u.sinceId || null;
      let matchedCount = 0;

      for (const tw of tweets) {
        if (!tw?.text || !tw.public_metrics) continue;
        if (!matchesAny(tw.text, matchers)) continue;

        matchedCount++;

        // Initial score (will be refined by hydration later)
        const score = scoreCreatorPost(
          {
            id: tw.id!,
            text: tw.text,
            created_at: tw.created_at,
            public_metrics: tw.public_metrics,
          },
          0 // skip followers lookup to keep this fast/cheap
        );

        // Store for hydration (unique per campaign+tweet)
        await TrackedTweet.updateOne(
          { campaignId: new mongoose.Types.ObjectId(campaignId), tweetId: tw.id! },
          {
            $setOnInsert: {
              authorId: tw.author_id!,
              username: u.username,
              avatar: u.avatar || "/avatar1.png",
              createdAt: new Date(),
            },
            $set: {
              public_metrics: tw.public_metrics,
              lastScore: score,
              refreshStage: 0,
              nextRefreshAt: new Date(Date.now() + REFRESH_OFFSETS[0]),
            },
          },
          { upsert: true }
        );

        // Add to this-run delta for leaderboard
        if (!deltaMap[tw.author_id!]) {
          deltaMap[tw.author_id!] = {
            author_id: tw.author_id!,
            username: u.username,
            avatar: u.avatar || "/avatar1.png",
            score: 0,
          };
        }
        deltaMap[tw.author_id!].score += score;

        if (!newest || BigInt(tw.id) > BigInt(newest)) newest = tw.id;
      }

      // Update user cursors + adaptive next poll time
      const nextPollAt =
        matchedCount > 0
          ? new Date(Date.now() + ACTIVE_BACKOFF_MS)
          : new Date(Date.now() + QUIET_BACKOFF_MS);

      await User.updateOne(
        { _id: (u as any)._id },
        {
          $set: {
            sinceId: newest ?? u.sinceId ?? null,
            lastPolledAt: new Date(),
            nextPollAt,
          },
        }
      );
    } catch (e: any) {
      console.warn(`⚠ Poll fail ${u.username}: ${e?.message || e}`);
      // Still rotate this user forward so others get a turn
      await User.updateOne(
        { _id: (u as any)._id },
        { $set: { lastPolledAt: new Date(), nextPollAt: new Date(Date.now() + 10 * 60 * 1000) } }
      );
    }
  }

  ensureTime(300);

  // Merge this-run delta into totals (accumulative leaderboard)
  const deltaRows = Object.values(deltaMap);
  if (!deltaRows.length) return;

  type LeaderboardRow = {
  author_id: string;
  username: string;
  avatar: string;
  score: number;
};

type LeaderboardDoc = {
  data: LeaderboardRow[];
};

  const existing = await Leaderboard.findOne(
    { campaignId: new mongoose.Types.ObjectId(campaignId) },
    { data: 1 }
  ).lean<LeaderboardDoc>();

  const totalsById = new Map<
    string,
    { author_id: string; username: string; avatar: string; score: number }
  >();

  if (existing?.data?.length) {
    for (const row of existing.data as any[]) {
      totalsById.set(row.author_id, {
        author_id: row.author_id,
        username: row.username,
        avatar: row.avatar,
        score: Number(row.score) || 0,
      });
    }
  }

  for (const row of deltaRows) {
    const prev = totalsById.get(row.author_id);
    if (prev) {
      prev.username = row.username || prev.username;
      prev.avatar = row.avatar || prev.avatar;
      prev.score += row.score;
    } else {
      totalsById.set(row.author_id, { ...row });
    }
  }

  const merged = Array.from(totalsById.values()).sort((a, b) => b.score - a.score);

  await Leaderboard.updateOne(
    { campaignId: new mongoose.Types.ObjectId(campaignId) },
    { $set: { data: merged, updatedAt: new Date() } },
    { upsert: true }
  );
  console.log(`✅ Leaderboard updated for ${campaignId},`);

}

/* ========================= 72H HYDRATOR ========================= */
/** Re-fetch metrics for tracked tweets (due now), recompute score,
 *  and add ONLY the delta points to the leaderboard. Runs in tiny
 *  batches (≤100 IDs) and stays inside ~7s soft budget. */
export async function refreshTweetMetrics(campaignId: string) {
  const started = Date.now();
  const timeLeft = () => HYDRATE_SOFT_BUDGET_MS - (Date.now() - started);
  const ensureTime = (reserve = 300) => {
    if (timeLeft() < reserve) throw new Error("⏱ Hydration budget reached");
  };

  await connectToDB();
  ensureTime();

  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.error("❌ Missing X_BEARER_TOKEN");
    return;
  }
  const twitter = new TwitterApi(token);

  // Get up to 100 tweets that are due for refresh now
  const due = await TrackedTweet.find(
    {
      campaignId: new mongoose.Types.ObjectId(campaignId),
      nextRefreshAt: { $lte: new Date() },
      refreshStage: { $lt: REFRESH_OFFSETS.length }, // still have stages left
    },
    "tweetId authorId username avatar public_metrics lastScore refreshStage campaignId"
  )
    .limit(HYDRATE_BATCH_TWEETS)
    .lean() as TrackedTweetDoc[];

  if (!due.length) return;

  const ids = due.map((d) => d.tweetId);
  const res = await twitter.v2.tweets(ids, { "tweet.fields": TWEET_FIELDS });
  ensureTime();

  const liveById = new Map<string, any>();
  for (const t of res.data ?? []) liveById.set(t.id, t);

  // Aggregate this hydration pass’s delta by author
  const hydrateDelta: Record<
    string,
    { author_id: string; username: string; avatar: string; score: number }
  > = {};

  for (const doc of due) {
    const live = liveById.get(doc.tweetId);

    if (!live || !live.public_metrics) {
      // Tweet deleted or missing metrics: stop refreshing it
      await TrackedTweet.updateOne(
        { campaignId: doc.campaignId, tweetId: doc.tweetId },
        { $set: { refreshStage: REFRESH_OFFSETS.length, nextRefreshAt: null } }
      );
      continue;
    }

    // Recompute score with latest metrics
    const newScore = scoreCreatorPost(
      {
        id: live.id,
        text: live.text || "",
        created_at: live.created_at,
        public_metrics: live.public_metrics,
      },
      0
    );

    const delta = Math.max(0, newScore - (doc.lastScore || 0));

    // Schedule next refresh (or stop after final stage)
    const nextStage = Math.min((doc.refreshStage || 0) + 1, REFRESH_OFFSETS.length);
    const nextAt =
      nextStage < REFRESH_OFFSETS.length
        ? new Date(Date.now() + REFRESH_OFFSETS[nextStage])
        : null;

    await TrackedTweet.updateOne(
      { campaignId: doc.campaignId, tweetId: doc.tweetId },
      {
        $set: {
          public_metrics: live.public_metrics,
          lastScore: newScore,
          refreshStage: nextStage,
          nextRefreshAt: nextAt,
        },
      }
    );

    if (delta > 0) {
      const authorId = doc.authorId;
      if (!hydrateDelta[authorId]) {
        hydrateDelta[authorId] = {
          author_id: authorId,
          username: doc.username,
          avatar: doc.avatar || "/avatar1.png",
          score: 0,
        };
      }
      hydrateDelta[authorId].score += delta;
    }
  }

  ensureTime(300);

  // Merge hydration deltas into leaderboard totals
  const deltaRows = Object.values(hydrateDelta);
  if (!deltaRows.length) return;

type LeaderboardRow = {
  author_id: string;
  username: string;
  avatar: string;
  score: number;
};

type LeaderboardDoc = {
  data: LeaderboardRow[];
};

  const existing = await Leaderboard.findOne(
    { campaignId: new mongoose.Types.ObjectId(campaignId) },
    { data: 1 }
  ).lean<LeaderboardDoc>();

  const totalsById = new Map<
    string,
    { author_id: string; username: string; avatar: string; score: number }
  >();

  if (existing?.data?.length) {
    for (const row of existing.data as any[]) {
      totalsById.set(row.author_id, {
        author_id: row.author_id,
        username: row.username,
        avatar: row.avatar,
        score: Number(row.score) || 0,
      });
    }
  }

  for (const row of deltaRows) {
    const prev = totalsById.get(row.author_id);
    if (prev) {
      prev.username = row.username || prev.username;
      prev.avatar = row.avatar || prev.avatar;
      prev.score += row.score; // add ONLY the extra points
    } else {
      totalsById.set(row.author_id, { ...row });
    }
  }

  const merged = Array.from(totalsById.values()).sort((a, b) => b.score - a.score);

  await Leaderboard.updateOne(
    { campaignId: new mongoose.Types.ObjectId(campaignId) },
    { $set: { data: merged, updatedAt: new Date() } },
    { upsert: true }
  );
   console.log(`✅ Leaderboard updated for ${campaignId},`);
}

/* ====================== HOW TO RUN (cron) ======================
 * - /api/poll    → calls startCampaignStream(campaignId) every 1–2 minutes
 * - /api/hydrate → calls refreshTweetMetrics(campaignId) every 10–15 minutes
 *
 * Ensure:
 *   export const runtime = 'nodejs20' in your API routes
 *   env: MONGO_URI, X_BEARER_TOKEN, CAMPAIGN_ID
 *   User model has: twitterId (numeric string), username, avatar, sinceId?, lastPolledAt?, nextPollAt?
 *   Campaign has: keywords: string[]
 *   Leaderboard: { campaignId, data:[{author_id, username, avatar, score}], updatedAt }
 */