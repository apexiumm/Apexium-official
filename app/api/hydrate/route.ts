import { refreshTweetMetrics } from "@/lib/startCampaignStream";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const campaignId = process.env.CAMPAIGN_ID!;
  await refreshTweetMetrics(campaignId);

  return new Response(
    JSON.stringify({ message: "Hydration completed" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}