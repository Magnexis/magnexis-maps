import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Magnexis Maps Admin",
  description: "Operations dashboard for Magnexis Maps",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Segoe UI, system-ui, sans-serif",
          background: "#08111F",
          color: "#F5F8FC",
        }}
      >
        {children}
      </body>
    </html>
  );
}
