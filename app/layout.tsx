import type { Metadata } from "next";
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
        <div className="noise" />
        {children}
      </body>
    </html>
  );
}
