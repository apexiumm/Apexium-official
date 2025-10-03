import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Campaign } from "@/models/Campaign";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ADMIN_USERS } from "@/config/admins";
import cloudinary from "@/lib/cloudinary";
import { startCampaignStream } from "@/lib/startCampaignStream";

export const runtime = "nodejs";

export async function GET() {
  await connectToDB();
  const campaigns = await Campaign.find().sort({ createdAt: -1 });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !ADMIN_USERS.includes(session.user.username!)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const keywords = formData.get("keywords") as string;
  const twitterLink = formData.get("twitterLink") as string;
  const imageFile = formData.get("image") as File | null;

  if (!title || !description || !keywords) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let imageUrl = "";
  if (imageFile) {
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "campaigns" }, (error, result) => {
          if (error || !result) return reject(error);
          resolve(result as { secure_url: string });
        })
        .end(buffer);
    });

    imageUrl = uploadResult.secure_url;
  }

  await connectToDB();
  const parsedKeywords = keywords.split(",").map(k => k.trim());

  const newCampaign = await Campaign.create({
    title,
    description,
    keywords: parsedKeywords,
    ...(imageUrl && { image: imageUrl }),
    ...(twitterLink && { twitterLink }),
    createdBy: session.user.username,
    status: "active"
  });

  // Trigger leaderboard immediately
  await startCampaignStream(newCampaign._id.toString());

  return NextResponse.json(newCampaign);
}

// PATCH route: activate campaign
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !ADMIN_USERS.includes(session.user.username!)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const campaignId = pathParts[2];

  const { status, ...updateData } = await req.json();

  await connectToDB();

  const updated = await Campaign.findByIdAndUpdate(campaignId, { ...updateData, status }, { new: true });
  if (!updated) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // Trigger leaderboard if campaign is active
  if (status === "active") {
    await startCampaignStream(campaignId);
  }

  return NextResponse.json(updated);
}
