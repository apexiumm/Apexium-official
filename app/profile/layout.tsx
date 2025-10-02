// src/app/(main)/layout.tsx
import Navbar from "@/components/Navbar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-950 text-white min-h-screen">
      <Navbar />
      <main className="p-4">{children}</main>
    </div>
  );
}