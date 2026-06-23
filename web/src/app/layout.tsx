import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forense",
  description: "APK Forensic Analysis Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
