import { startCampaignStream } from "@/lib/startCampaignStream";

export const runtime = "nodejs20";

export async function GET(req: Request) {
  const campaignId = process.env.CAMPAIGN_ID!;
  await startCampaignStream(campaignId);

  return new Response(
    JSON.stringify({ message: "Poll completed" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}