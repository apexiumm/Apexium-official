"use client";

import { useState } from "react";
import Image from "next/image";
import { CampaignType } from "@/types/campaign";

interface CampaignCardProps {
  campaign: CampaignType;
  onUpdate?: (updated: CampaignType) => void;
  onDelete?: (id: string) => void;
}

export default function CampaignCard({ campaign, onUpdate, onDelete }: CampaignCardProps) {
  const [loading, setLoading] = useState(false);

  // Toggle campaign status
  const handleStatusToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: campaign.status === "active" ? "ended" : "active",
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      const data = await res.json();
      if (onUpdate) onUpdate(data);
    } catch (err) {
      console.error("Error updating campaign:", err);
    } finally {
      setLoading(false);
    }
  };

  // Delete campaign
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete campaign");
      if (onDelete) onDelete(campaign._id);
    } catch (err) {
      console.error("Error deleting campaign:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 shadow-md border border-gray-800">
      {/* Image */}
      {campaign.image && (
        <div className="mb-4">
          <Image
            src={campaign.image}
            alt={campaign.title}
            width={600}
            height={400}
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>
      )}

      {/* Title & Description */}
      <h3 className="text-lg font-bold text-[#5ED48A]">{campaign.title}</h3>
      <p className="text-gray-300 mt-2">{campaign.description}</p>

      {/* Keywords */}
      <div className="mt-2 flex flex-wrap gap-2">
        {campaign.keywords.map((k, idx) => (
          <span
            key={idx}
            className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded-full"
          >
            {k}
          </span>
        ))}
      </div>

      {/* Twitter Link */}
      {campaign.twitterLink && (
        <div className="mt-3">
          <a
            href={campaign.twitterLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline text-sm"
          >
            View on Twitter
          </a>
        </div>
      )}

      {/* Buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleStatusToggle}
          disabled={loading}
          className={`px-3 py-1 rounded-md text-sm ${
            campaign.status === "active"
              ? "bg-yellow-500 text-black"
              : "bg-green-600 text-white"
          }`}
        >
          {campaign.status === "active" ? "End Campaign" : "Activate Campaign"}
        </button>

        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-1 rounded-md text-sm bg-red-600 text-white"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

