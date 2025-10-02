// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AdminCampaignForm from "@/components/AdminCampaignForm";
import CampaignCard from "@/components/CampaignCard";
import { ADMIN_USERS } from "@/config/admins";
import { CampaignType } from "@/types/campaign";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignType[]>([]);
  const [loading, setLoading] = useState(true);

  // Restrict access to admins only
  useEffect(() => {
    if (status === "loading") return;
    if (!session || !ADMIN_USERS.includes(session.user.username!)) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      setCampaigns(data);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchCampaigns();
  }, [session]);

  // Add a new campaign to the list
  const handleNewCampaign = (campaign: CampaignType) => {
    setCampaigns((prev) => [campaign, ...prev]);
  };

  // Update campaign after edit
  const handleUpdateCampaign = (updated: CampaignType) => {
    setCampaigns((prev) =>
      prev.map((c) => (c._id === updated._id ? updated : c))
    );
  };

  // Remove campaign after delete
  const handleDeleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c._id !== id));
  };

  if (status === "loading" || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p>Loading admin panel...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-8">
      <h1 className="text-3xl font-bold text-[#5ED48A] mb-6">Admin Panel</h1>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Create New Campaign</h2>
        <AdminCampaignForm onSuccess={handleNewCampaign} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Existing Campaigns</h2>
        {loading ? (
          <p>Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <p>No campaigns yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard
                key={c._id}
                campaign={c}
                onUpdate={handleUpdateCampaign}
                onDelete={handleDeleteCampaign}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}


