// app/api/campaigns/[id]/leaderboard/route.ts
import { connectToDB } from "@/lib/mongodb";
import { Leaderboard } from "@/models/Leaderboard";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const campaignId = pathParts[2];

    await connectToDB();

    const lb = await Leaderboard.findOne({
      campaignId: new mongoose.Types.ObjectId(campaignId),
    });

    return new Response(
      JSON.stringify(lb?.data || []),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Leaderboard route error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}
