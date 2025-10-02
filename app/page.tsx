"use client";

import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect immediately if user is authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  // Show nothing while loading or redirecting
  if (status === "loading" || status === "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-lg animate-pulse">Loading...</p>
      </main>
    );
  }

  const handleSignIn = () => {
    signIn("twitter", { callbackUrl: "/dashboard" });
  };

  return (
    <main className="relative flex min-h-screen flex-col text-white px-6 font-sans">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/apexiumbg.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/70" />
      </div>

      {/* Header */}
      <header className="flex items-center  mx-auto w-full">
        <div className="flex items-center">
          <Image
            src="/apexiumlogo.png"
            alt="Apexium Logo"
            width={60}
            height={60}
            className="mr-4"
          />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-wide text-[#5ED48A]">
            APEX DRILL
          </h1>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-1 flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-0">
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-4.5xl font-extrabold mb-6 leading-tight sm:leading-snug">
          The first proof-of-work system where <span className="text-[#5ED48A]">Builders Earn Their Proof</span>
        </h2>
        <p className="text-base sm:text-lg lg:text-xl mb-12 text-gray-200 max-w-lg sm:max-w-xl md:max-w-2xl">
          Track your contributions, engage with campaigns, and climb the leaderboard with verified achievements.
        </p>

        {/* CTA Button */}
        <button
          onClick={handleSignIn}
          className="flex items-center justify-center space-x-3 px-8 py-4 rounded-3xl bg-gradient-to-r from-[#5ED48A] to-[#3bb16f] 
             hover:scale-105 active:rotate-6 transition-transform duration-300 shadow-xl text-lg sm:text-xl font-semibold text-black cursor-pointer"
        >
          <span>Connect with</span>
          <Image
            src="/xlogo.svg"
            alt="X Logo"
            width={32}
            height={32}
            className="pl-1"
          />
        </button>

      </section>

      {/* Footer CTA / Accent */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#5ED48A] text-sm sm:text-base text-center max-w-md">
        Join the revolution of verified builders. <br />
        All progress is transparent and leaderboard-ready.
      </div>
    </main>
  );
}
