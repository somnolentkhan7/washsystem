export const metadata = {
  title: 'Strong Washing',
  description: 'Strong Power Washing Services',
  icons: {
    icon: "/icon.png",
  },
  apple: "/apple-touch-icon.png",
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
