import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Strong Washing",
  description: "Strong Power Washing Services",
  icons: {
    icon: "/icon-v2.png",
    apple: "/apple-touch-icon-v2.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Extra fallback for stubborn iOS behavior */}
        <link rel="apple-touch-icon" href="/apple-touch-icon-v2.png" />
        <link rel="icon" href="/icon-v2.png" />
      </head>

      <body>{children}</body>
    </html>
  );
}