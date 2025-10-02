import { Schema, model, models } from "mongoose";

const LeaderboardSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, unique: true },
    data: [
      {
        author_id: String,
        username: String,
        avatar: String,
        score: Number,
        rank: Number,
      },
    ],
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Leaderboard = models.Leaderboard || model("Leaderboard", LeaderboardSchema);
