// types/campaign.ts
export interface CampaignType {
  _id: string;
  title: string;
  description: string;
  keywords: string[];
  status: "active" | "ended";
  image?: string;       // campaign image URL
  twitterLink?: string; // campaign Twitter link
  createdBy?: string;   // username of creator
  createdAt?: string;
  updatedAt?: string;
}
