// components/UserCampaignCard.tsx
import Image from "next/image";
import Link from "next/link";

interface UserCampaignCardProps {
  id: string;
  title: string;
  description: string;
  image?: string;
  status: "active" | "ended";
}

export default function UserCampaignCard({ id, title, description, image, status }: UserCampaignCardProps) {
  return (
    <Link
      href={`/campaigns/${id}`}
      className="block bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-md transition-transform transform hover:scale-105 hover:shadow-lg"
    >
      {image && (
        <div className="mb-4">
          <Image
            src={image}
            alt={title}
            width={600}
            height={600}
            className="w-full h-60 object-cover rounded-lg"
          />
        </div>
      )}
      <h3 className="text-4xl font-bold text-[#5ED48A] mt-10">{title}</h3>
      <p className="text-gray-300 text-xl mt-5">{description}</p>
      <p className="mt-5 text-xs text-gray-300">
                Click to view the leaderboard and check your rank.
              </p>
      <span
        className={`mt-5 inline-block px-2 py-1 text-xs rounded-full ${
          status === "active" ? "bg-green-600 text-white" : "bg-gray-600 text-gray-200"
        }`}
      >
        {status.toUpperCase()}
      </span>
      
    </Link>
  );
}
