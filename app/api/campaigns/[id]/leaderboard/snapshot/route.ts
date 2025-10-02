// app/api/campaigns/[id]/leaderboard/snapshot/route.ts
import { connectToDB } from "@/lib/mongodb";
import { Leaderboard } from "@/models/Leaderboard"; // ✅ new model
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const campaignId = pathParts[2];

    await connectToDB();

   const leaderboardDoc = await Leaderboard.findOne({ campaignId: new mongoose.Types.ObjectId(campaignId) });
    if (!leaderboardDoc) {
      return new Response(JSON.stringify({ leaderboard: [] }), { status: 200 });
    }

    return new Response(
      JSON.stringify({ leaderboard: leaderboardDoc.data || [] }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Leaderboard snapshot error:", err);
    return new Response(JSON.stringify({ leaderboard: [] }), { status: 500 });
  }
}
