import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VASUDHA CONNECT ADMIN",
  description: "VASUDHA CONNECT administration dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
