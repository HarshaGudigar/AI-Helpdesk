import './globals.css'

export const metadata = {
  title: 'AI Helpdesk - Knowledge Base Assistant',
  description: 'An AI-powered helpdesk that answers questions based on your knowledge base.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4263eb" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body style={{ backgroundColor: '#fff' }}>
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
