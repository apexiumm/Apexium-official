import "./globals.css";
import Providers from "@/components/Provider";

export const metadata = {
  title: "Apexium InfoFi",
  description: "Turn conversations into campaigns with Apexium InfoFi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

