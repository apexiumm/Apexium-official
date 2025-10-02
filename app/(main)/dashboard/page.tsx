"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {  FaTelegram } from "react-icons/fa";

// Types
interface Campaign {
  _id: string;
  title: string;
  description: string;
  image: string;
}

export default function Dashboard() {
  const currentYear = typeof window !== "undefined" ? new Date().getFullYear() : "";
  const { data: session, status } = useSession();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Fetch campaigns
  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch("/api/campaigns"); // API returns campaigns
        const data: Campaign[] = await res.json();
        setCampaigns(data);
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") fetchCampaigns();
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-lg">Loading your dashboard...</p>
      </main>
    );
  }

  if (!session) return null;

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 pt-15">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-center mb-6 gap-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center text-[#5ED48A]">
          Welcome to APEX DRILL, @{session.user?.username} 👋
        </h1>
        <Image
          src="/apexiumanimate.jpg"
          alt="Welcome animation"
          width={120}
          height={120}
          className="w-24 sm:w-32 md:w-36 lg:w-40 object-contain"
        />

      </div>


      {/* Profile Card */}
      <section className="bg-gray-900 p-8 rounded-2xl shadow-lg mb-10 flex flex-col md:flex-row md:items-center gap-6">
        {/* Profile Image */}
        <div className="flex-shrink-0 flex justify-center md:justify-start">
          <Image
            src={session.user?.image || "/profilepic.jpg"}
            alt="User avatar"
            width={140}
            height={140}
            className="w-32 h-32 md:w-40 md:h-40 object-cover border-4 border-[#5ED48A] clip-hexagon"
          />
        </div>

        {/* Profile Info + Call to Action */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <h2 className="text-3xl md:text-4xl font-bold text-[#5ED48A]">{session.user?.name}</h2>
            <p className="text-gray-400 text-lg md:text-xl">@<a className="hover:underline" href={`https://x.com/${session.user?.username}`}>{session.user?.username}</a></p>
          </div>

          <p className="text-[#5ED48A] text-lg md:text-2xl lg:text-3xl font-semibold text-center md:text-right">
            Ready to join campaigns? <br className="md:hidden" />Check below!
          </p>
        </div>
      </section>



      {/* Campaigns */}
      <section>
        <h2 className="text-3xl font-bold mb-10 text-[#5ED48A] mt-20">CAMPAIGNS</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign._id}
              href={`/campaigns/${campaign._id}`}
              className="bg-gray-900 p-6 rounded-2xl shadow-lg flex flex-col hover:shadow-xl transition"
            >
              {/* Campaign Image */}
              <Image
                src={campaign.image || "/campaign-placeholder.jpg"}
                alt={campaign.title}
                width={600}
                height={400}
               className="w-full h-48 object-cover rounded-lg"
              />

              {/* Campaign Info */}
              <h3 className="text-4xl mt-10 font-semibold mb-2 text-[#5ED48A]">{campaign.title}</h3>
              <p className="text-gray-400 mt-5 mb-4 text-xl">{campaign.description}</p>

              {/* Click Prompt */}
              <p className="mt-auto text-xs text-gray-300">
                Click to view the leaderboard and check your rank.
              </p>
            </Link>
          ))}
        </div>
      </section>
   
      



      {/* Footer */}

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


    </main>
  );
}
