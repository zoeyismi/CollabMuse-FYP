import type { Metadata } from "next";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "CollabMuse | Real-time Collaborative Music Composition",
  description:
    "A first-stage FYP prototype for event-based collaborative music editing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LanguageProvider>
          <div className="noise" />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
