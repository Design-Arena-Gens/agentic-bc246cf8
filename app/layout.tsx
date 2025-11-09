import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suno Companion Agent",
  description:
    "Upload and organize your Suno AI tracks with an intelligent assistant."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
