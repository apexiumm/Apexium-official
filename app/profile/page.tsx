"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { FaTelegram } from "react-icons/fa";

interface CampaignLeaderboardEntry {
  username: string;
  avatar: string;
  score: number;
  rank: number;
}

interface Campaign {
  _id: string;
  title: string;
}

export default function ProfilePage() {
  const currentYear =
    typeof window !== "undefined" ? new Date().getFullYear() : "";
  const { data: session, status } = useSession();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leaderboards, setLeaderboards] = useState<
    Record<string, CampaignLeaderboardEntry | null>
  >({});
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const username = session?.user?.username;

  useEffect(() => {
    if (status !== "authenticated" || !username) return;

    async function fetchProfileData() {
      try {
        // 1️⃣ Fetch all campaigns
        const res = await fetch("/api/campaigns");
        if (!res.ok) throw new Error("Failed to fetch campaigns");
        const campaignsData: Campaign[] = await res.json();
        setCampaigns(campaignsData);

        // 2️⃣ Fetch DB leaderboard for each campaign
        const leaderboardResults: Record<string, CampaignLeaderboardEntry | null> = {};
        let total = 0;

        for (const campaign of campaignsData) {
          try {
            const lbRes = await fetch(
              `/api/campaigns/${campaign._id}/leaderboard/snapshot`
            );
            if (!lbRes.ok) throw new Error("Failed to fetch leaderboard");

            const lbData = await lbRes.json();
            const leaderboard: CampaignLeaderboardEntry[] =
              lbData.leaderboard ?? [];

            const userEntry = leaderboard.find((e) => e.username === username);
            if (userEntry) total += userEntry.score;

            leaderboardResults[campaign._id] = userEntry ?? null;
          } catch (err) {
            console.error(
              `Failed to fetch leaderboard for campaign ${campaign._id}`,
              err
            );
            leaderboardResults[campaign._id] = null;
          }
        }

        setLeaderboards(leaderboardResults);
        setTotalPoints(total);
      } catch (err) {
        console.error("Failed to fetch profile data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfileData();
  }, [status, username]);

  if (status === "loading" || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-lg">Loading your profile...</p>
      </main>
    );
  }

  if (!session?.user) return null;

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-8 pt-28">
      {/* Welcome Message */}
      <section className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#5ED48A]">
          Welcome, {session.user.name}!
        </h1>
        <p className="text-gray-400 text-lg mt-2">
          Here’s your current campaign progress.
        </p>
      </section>

      {/* Profile Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-start bg-gray-900 p-8 rounded-2xl shadow-lg gap-6 mb-10">
        <div className="flex-shrink-0">
          <Image
            src={session.user.image || "/profilepic.jpg"}
            alt="User avatar"
            width={200}
            height={200}
            className="w-48 h-48 sm:w-56 sm:h-56 object-cover border-4 border-[#5ED48A] clip-hexagon"
          />
        </div>
        <div className="flex flex-col sm:ml-6 justify-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#5ED48A]">
            {session.user.name}
          </h2>
          <p className="text-gray-400 text-lg sm:text-xl">@{username}</p>
        </div>
      </section>

      {/* Total Points */}
      <section className="bg-gray-900 p-6 rounded-2xl shadow-lg mb-10 text-center">
        <p className="text-gray-400 text-lg">Total Points</p>
        <h3 className="text-3xl sm:text-4xl font-bold text-[#5ED48A]">
          {totalPoints}
        </h3>
      </section>

      {/* Campaign Scores */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-[#5ED48A] mb-4">
          Your Campaigns
        </h2>
        {campaigns.length === 0 ? (
          <p className="text-gray-300">
            You have not participated in any campaigns yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => {
              const entry = leaderboards[campaign._id];
              return (
                <div
                  key={campaign._id}
                  className="bg-gray-900 p-4 rounded-2xl shadow-md hover:shadow-lg transition"
                >
                  <h3 className="text-lg font-semibold text-[#5ED48A] mb-2">
                    {campaign.title}
                  </h3>
                  {entry ? (
                    <>
                      <div className="flex justify-between text-gray-300">
                        <span>Points:</span>
                        <span>{entry.score}</span>
                      </div>
                     
                    </>
                  ) : (
                    <p className="text-gray-400">Not participated</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Logout Button */}
      <div className="mt-10 text-center">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md transition-transform hover:scale-105"
        >
          Sign Out
        </button>
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
        </section>
        <br />
        © {currentYear} Apex Academia Drill. All rights reserved.
      </footer>
    </main>
  );
}
