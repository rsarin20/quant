import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Mirror — How you show up in AI",
  description:
    "See how you show up across AI assistants, then generate a machine-readable profile so AI finds you, gets you right, and can cite it.",
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
