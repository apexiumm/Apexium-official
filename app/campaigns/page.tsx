"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import UserCampaignCard from "@/components/UserCampaignCard";
import { FaTelegram } from "react-icons/fa";

interface CampaignType {
  _id: string;
  title: string;
  description: string;
  image?: string;
  status: "active" | "ended";
}

export default function CampaignsPage() {
  const currentYear = typeof window !== "undefined" ? new Date().getFullYear() : "";
  const [campaigns, setCampaigns] = useState<CampaignType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch("/api/campaigns");
        const data = await res.json();
        setCampaigns(data);
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCampaigns();
  }, []);

  if (loading) return <p className="text-white text-center mt-20">Loading campaigns...</p>;
  if (campaigns.length === 0)
    return <div><p className="text-white text-center mt-20">No campaigns available.</p>
    <footer className=" py-6 text-center text-gray-400 border-t border-gray-800 mt-[450px]">
              {/* Follow Us Section */}
            <section className="mt-12 flex justify-center space-x-6">
              <a
                href="https://x.com/ApexiumAgency"
                target="_blank"
                className="text-[#5ED48A] hover:text-white transition text-3xl bg-[#5ED48A] rounded-full"
              >
                <Image
                  src="/xlogo.svg"
                  alt="X Logo"
                  width={32}
                  height={32}
                  className="pl-1"
                />
              </a>
              <a
                href="https://t.me/ApexiumAgency"
                target="_blank"
                className="text-[#5ED48A] hover:text-white transition text-3xl"
              >
                <FaTelegram />
              </a>
            </section><br />
      
              © {currentYear} Apex Academia Drill. All rights reserved.
            </footer>
    </div>;
  

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white pt-24 px-6">
      {/* Welcome Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-[#5ED48A]">Welcome to Campaigns</h1>
        <p className="text-gray-300 text-2xl mt-4 max-w-2xl mx-auto">
          Explore all active and past campaigns. Click on any campaign to see its leaderboard and join the challenge!
        </p>
      </div>

      {/* Campaign Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {campaigns.map(c => (
          <UserCampaignCard
            key={c._id}
            id={c._id}
            title={c.title}
            description={c.description}
            image={c.image}
            status={c.status}
          />
        ))}
      </div>
       <footer className="mt-12 py-6 text-center text-gray-400 border-t border-gray-800">
              {/* Follow Us Section */}
            <section className="mt-12 flex justify-center space-x-6">
              <a
                href="https://x.com/ApexiumAgency"
                target="_blank"
                className="text-[#5ED48A] hover:text-white transition text-3xl bg-[#5ED48A] rounded-full"
              >
                <Image
                  src="/xlogo.svg"
                  alt="X Logo"
                  width={32}
                  height={32}
                  className="pl-1"
                />
              </a>
              <a
                href="https://t.me/ApexiumAgency"
                target="_blank"
                className="text-[#5ED48A] hover:text-white transition text-3xl"
              >
                <FaTelegram />
              </a>
            </section><br />
      
              © {currentYear} Apex Academia Drill. All rights reserved.
            </footer>
      
    </div>
  );
}
