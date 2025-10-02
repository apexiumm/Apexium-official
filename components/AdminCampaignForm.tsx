"use client";

import { useState } from "react";
import { CampaignType } from "@/types/campaign";

interface AdminCampaignFormProps {
  onSuccess: (campaign: CampaignType) => void;
}

export default function AdminCampaignForm({ onSuccess }: AdminCampaignFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [twitterLink, setTwitterLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("keywords", keywords);
      if (twitterLink) formData.append("twitterLink", twitterLink);
      if (imageFile) formData.append("image", imageFile);

      const res = await fetch("/api/campaigns", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to create campaign");

      const data: CampaignType = await res.json();
      onSuccess(data);

      // Reset form
      setTitle("");
      setDescription("");
      setKeywords("");
      setTwitterLink("");
      setImageFile(null);
    } catch (err) {
      console.error("Error creating campaign:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-md space-y-4"
    >
      {/* Title */}
      <div>
        <label className="block text-sm mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-white"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-white"
          required
        />
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-sm mb-1">Keywords (comma separated)</label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-white"
          placeholder="e.g. crypto, defi, infofi"
          required
        />
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm mb-1">Campaign Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
          className="w-full text-white"
        />
      </div>

      {/* Twitter Link */}
      <div>
        <label className="block text-sm mb-1">Twitter Link</label>
        <input
          type="url"
          value={twitterLink}
          onChange={(e) => setTwitterLink(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-white"
          placeholder="https://x.com/username"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-[#5ED48A] text-black font-semibold rounded-md hover:bg-[#4EC07A] disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Campaign"}
      </button>
    </form>
  );
}


