"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { FaTelegram } from "react-icons/fa";

interface LeaderboardEntry {
  author_id: string;
  username: string;
  avatar: string;
  score: number;
}

interface CampaignType {
  _id: string;
  title: string;
  description: string;
  image?: string;
  status: "active" | "ended";
}

export default function CampaignDetailPage() {
  const currentYear =
    typeof window !== "undefined" ? new Date().getFullYear() : "";
  const params = useParams();
  const id = params?.id;

  const [campaign, setCampaign] = useState<CampaignType | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 100;

  useEffect(() => {
    if (!id) return;

    async function fetchCampaign() {
      try {
        const res = await fetch(`/api/campaigns/${id}`);
        if (!res.ok) throw new Error("Failed to fetch campaign");
        const data: CampaignType = await res.json();
        setCampaign(data);
      } catch (err) {
        console.error("Failed to fetch campaign:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCampaign();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    async function fetchLeaderboard() {
      try {
        const res = await fetch(`/api/campaigns/${id}/leaderboard/snapshot`);
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      }
    }

    fetchLeaderboard();

    const interval = window.setInterval(fetchLeaderboard, 60 * 1000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading)
    return <p className="text-white text-center mt-24">Loading...</p>;
  if (!campaign)
    return <p className="text-white text-center mt-24">Campaign not found</p>;

  // Sort leaderboard by score descending
  const sortedLeaderboard = [...leaderboard].sort((a, b) => b.score - a.score);

  // Pagination logic
  const totalPages = Math.ceil(sortedLeaderboard.length / entriesPerPage);
  const paginatedLeaderboard = sortedLeaderboard.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  return (
    <div className="p-6 pt-28 max-w-7xl mx-auto">
      {campaign.image && (
        <div className="relative w-full h-64 sm:h-80 md:h-96 mb-6 rounded-xl overflow-hidden shadow-lg">
          <Image
            src={campaign.image}
            alt={campaign.title}
            fill
            className="object-cover"
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#5ED48A]">
          {campaign.title}
        </h1>
        <h2 className="text-xl sm:text-2xl font-semibold text-white">
          Leaderboard
        </h2>
      </div>

      {paginatedLeaderboard.length === 0 ? (
        <p className="text-white text-center py-12">No entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl shadow-lg">
          <table className="min-w-full text-left border-collapse">
            <thead className="bg-[#5ED48A]/20">
              <tr>
                <th className="px-4 py-3 text-gray-200 font-semibold">Rank</th>
                <th className="px-4 py-3 text-gray-200 font-semibold">User</th>
                <th className="px-4 py-3 text-gray-200 font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeaderboard.map((entry, idx) => {
                const rank = (currentPage - 1) * entriesPerPage + idx + 1;

                const rowGlow: Record<number, string> = {
                  1: "bg-yellow-500/10",
                  2: "bg-gray-400/10",
                  3: "bg-amber-700/10",
                };

                const rankStyles: Record<number, string> = {
                  1: "text-yellow-400 font-extrabold text-2xl",
                  2: "text-gray-300 font-bold text-xl",
                  3: "text-amber-700 font-bold text-xl",
                };

                const rankIcons: Record<number, string> = {
                  1: "👑",
                  2: "🥈",
                  3: "🥉",
                };

                return (
                  <tr
                    key={entry.author_id}
                    className={`border-b border-gray-700 hover:bg-[#5ED48A]/20 transition ${
                      rowGlow[rank] || ""
                    }`}
                  >
                    <td
                      className={`px-4 py-3 font-medium ${
                        rankStyles[rank] || "text-white"
                      }`}
                    >
                      {rankIcons[rank] ? (
                        <span className="flex items-center gap-1">
                          {rankIcons[rank]} {rank}
                        </span>
                      ) : (
                        rank
                      )}
                    </td>

                    <td className="px-4 py-3 flex items-center gap-3">
                      <a
                        href={`https://x.com/${entry.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Image
                          src={entry.avatar || "/avatar1.png"}
                          alt={entry.username}
                          width={36}
                          height={36}
                          className="rounded-full object-cover"
                        />
                        <span className="text-white font-medium">
                          @{entry.username}
                        </span>
                      </a>
                    </td>

                    <td className="px-4 py-3 font-semibold text-white">
                      {entry.score}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-3 mt-6">
          <button
            className="px-3 py-1 bg-[#5ED48A] text-white rounded disabled:opacity-50"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
          >
            Previous
          </button>
          <span className="text-white px-2 py-1">{currentPage}</span>
          <button
            className="px-3 py-1 bg-[#5ED48A] text-white rounded disabled:opacity-50"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      )}

      <footer className="mt-12 py-6 text-center text-gray-400 border-t border-gray-800">
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
    </div>
  );
}
