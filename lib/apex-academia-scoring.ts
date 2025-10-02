// lib/apex-academia-scoring.ts

// ---------- Tunables ----------
const WEIGHTS = {
  like: 1.0,
  reply: 4.0,
  retweet: 2.5,
  quote: 3.0,
};

const MIN_RAW_UNITS = 6;
const EFFECTIVE_FOLLOWERS_FLOOR = 500;
const EFFECTIVE_FOLLOWERS_CEILING = 150_000;
const FOLLOWER_FAIRNESS_EXP = 0.55;

const PER_POST_EXPONENT = 0.92;
const PER_POST_CAP = 300;

const QUALITY_REPLY_HEAVY_BONUS = 0.10;
const QUALITY_QUOTE_HEAVY_BONUS = 0.05;
const QUALITY_LIKE_HEAVY_PENALTY = -0.10;
const QUALITY_MIN_MULT = 0.85;
const QUALITY_MAX_MULT = 1.20;

const MIN_TEXT_CHARS = 20;
const MIN_UNIQUE_WORDS = 6;

// ---------- Types ----------
export type TweetPublicMetrics = {
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  quote_count?: number;
};

export type TweetV2Lite = {
  id: string;
  text?: string;
  created_at?: string;
  public_metrics?: TweetPublicMetrics;
};

// ---------- Helpers ----------
const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
const safe = (n?: number) =>
  typeof n === "number" && isFinite(n) ? n : 0;

const uniqWordsCount = (s?: string) => {
  if (!s) return 0;
  const words = s
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  return new Set(words).size;
};

// ---------- Core Scoring ----------
export function scoreCreatorPost(
  tweet: TweetV2Lite,
  authorFollowers: number
): number {
  const m = tweet.public_metrics || {};
  const likes = safe(m.like_count);
  const replies = safe(m.reply_count);
  const rts = safe(m.retweet_count);
  const quotes = safe(m.quote_count);

  // Basic quality gate
  if ((tweet.text?.length || 0) < MIN_TEXT_CHARS) return 0;
  if (uniqWordsCount(tweet.text) < MIN_UNIQUE_WORDS) return 0;

  // Raw engagement units
  const rawUnits =
    WEIGHTS.like * likes +
    WEIGHTS.reply * replies +
    WEIGHTS.retweet * rts +
    WEIGHTS.quote * quotes;

  if (rawUnits < MIN_RAW_UNITS) return 0;

  // Fairness normalization
  const effFollowers = clamp(
    authorFollowers,
    EFFECTIVE_FOLLOWERS_FLOOR,
    EFFECTIVE_FOLLOWERS_CEILING
  );
  const fairnessDivisor = Math.pow(effFollowers, FOLLOWER_FAIRNESS_EXP);
  const normalized = rawUnits / fairnessDivisor;

  // Diminishing returns
  let postScore = Math.pow(normalized, PER_POST_EXPONENT);

  // Quality multiplier
  const totalEng = likes + replies + rts + quotes;
  let qMult = 1.0;
  if (totalEng > 0) {
    const replyShare = replies / totalEng;
    const quoteShare = quotes / totalEng;
    const likeShare = likes / totalEng;

    if (replyShare >= 0.2) qMult += QUALITY_REPLY_HEAVY_BONUS;
    if (quoteShare >= 0.15) qMult += QUALITY_QUOTE_HEAVY_BONUS;
    if (likeShare >= 0.8) qMult += QUALITY_LIKE_HEAVY_PENALTY;
  }
  qMult = clamp(qMult, QUALITY_MIN_MULT, QUALITY_MAX_MULT);

  postScore *= qMult;

  return Math.min(PER_POST_CAP, postScore);
}
