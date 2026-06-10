export const metadata = {
  title: 'Strong Washing',
  description: 'Strong Power Washing Services',
  icons: {
    icon: "/icon-v2.png",
  },
  apple: "/apple-touch-icon-v2.png",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
