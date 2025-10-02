"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X, ExternalLink } from "lucide-react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Utility to check if a link is active
  const linkClass = (href: string) =>
    pathname === href
      ? "text-[#5ED48A] font-bold text-xl"
      : "text-gray-200 hover:text-[#5ED48A] transition-colors duration-200 text-xl";

  return (
    <nav className="fixed w-full z-50 bg-gray-900 bg-opacity-95 backdrop-blur-md text-white shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <Image
            src="/apexiumlogo.png"
            alt="Apexium Logo"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#5ED48A] tracking-wide">
            APEX DRILL
          </span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-8 font-semibold">
          <Link href="/dashboard" className={linkClass("/dashboard")}>
            Dashboard
          </Link>
          <Link href="/campaigns" className={linkClass("/campaigns")}>
            Campaigns
          </Link>
          <Link href="/profile" className={linkClass("/profile")}>
            Profile
          </Link>

          {/* External Blog Link */}
          <a
            href="https://t.co/BUhHFXmxEg"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-200 hover:text-[#5ED48A] transition-colors duration-200 flex items-center gap-1 text-xl"
          >
            Blog <ExternalLink size={16} />
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-gray-200 hover:text-[#5ED48A] transition-colors duration-200"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-gray-900 bg-opacity-95 backdrop-blur-md shadow-inner flex flex-col space-y-3 px-6 py-4">
          <Link
            href="/dashboard"
            className={linkClass("/dashboard")}
            onClick={() => setIsOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/campaigns"
            className={linkClass("/campaigns")}
            onClick={() => setIsOpen(false)}
          >
            Campaigns
          </Link>
          <Link
            href="/profile"
            className={linkClass("/profile")}
            onClick={() => setIsOpen(false)}
          >
            Profile
          </Link>

          {/* External Blog Link */}
          <a
            href="https://t.co/BUhHFXmxEg"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-200 hover:text-[#5ED48A] transition-colors duration-200 flex items-center gap-1"
            onClick={() => setIsOpen(false)}
          >
            Blog <ExternalLink size={16} />
          </a>
        </div>
      )}
    </nav>
  );
}
