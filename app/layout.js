'use client';

import './globals.css'
import { useEffect, useState } from 'react';

// Metadata needs to be in a separate file for client components
// This is just for reference
const metadataInfo = {
  title: 'AI Helpdesk - Knowledge Base Assistant',
  description: 'An AI-powered helpdesk that answers questions based on your knowledge base.',
}

export default function RootLayout({ children }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('aiHelpdeskTheme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4263eb" />
        <link rel="icon" href="/favicon.ico" />
        <title>{metadataInfo.title}</title>
        <meta name="description" content={metadataInfo.description} />
      </head>
      <body>
        <main style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '20px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {children}
        </main>
      </body>
    </html>
  )
}
