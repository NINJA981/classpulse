import './globals.css';

export const metadata = {
  title: 'ClassPulse - Smart Education Management System',
  description: 'Smart Classroom & Administration Workbench',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=VT323&family=Silkscreen&family=Space+Mono:wght@400;700&family=Architects+Daughter&family=Caveat:wght@600;700&family=Kalam:wght@400;700&family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
