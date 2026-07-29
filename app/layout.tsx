import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EVE",
  description: "A general-purpose chat agent with a file-first soul.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
