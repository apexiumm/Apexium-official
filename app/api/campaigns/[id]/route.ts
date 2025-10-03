import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Campaign } from "@/models/Campaign";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ADMIN_USERS } from "@/config/admins";

// GET a single campaign (public)
export async function GET(_req: Request) {
  try {
    const url = new URL(_req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const campaignId = pathParts[2];

    await connectToDB();

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    return NextResponse.json(campaign);
  } catch (err) {
    console.error("GET campaign error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH a campaign (admin only)
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ADMIN_USERS.includes(session.user.username!)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const campaignId = pathParts[2];

    const { title, description, keywords, status, image, twitterLink } = await req.json();

    await connectToDB();

    const updateData: Partial<any> = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (keywords)
      updateData.keywords = Array.isArray(keywords)
        ? keywords
        : keywords.split(",").map((k: string) => k.trim());
    if (status) updateData.status = status;
    if (image !== undefined) updateData.image = image;
    if (twitterLink !== undefined) updateData.twitterLink = twitterLink;

    const updated = await Campaign.findByIdAndUpdate(campaignId, updateData, { new: true });
    if (!updated) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    // Trigger leaderboard if campaign is active
    if (updated.status === "active") {
      const { startCampaignStream } = await import("@/lib/startCampaignStream");
      await startCampaignStream(campaignId);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH campaign error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE a campaign (admin only)
export async function DELETE(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ADMIN_USERS.includes(session.user.username!)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(_req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const campaignId = pathParts[2];

    await connectToDB();

    const deleted = await Campaign.findByIdAndDelete(campaignId);
    if (!deleted) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    return NextResponse.json({ message: "Campaign deleted" });
  } catch (err) {
    console.error("DELETE campaign error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
