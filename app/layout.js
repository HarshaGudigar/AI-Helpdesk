import './globals.css'

export const metadata = {
  title: 'AI Helpdesk',
  description: 'AI-powered helpdesk with knowledge base',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ 
        margin: 0, 
        padding: 0, 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: '100vh' 
        }}>
          <header style={{ 
            backgroundColor: '#fff', 
            borderBottom: '1px solid #ddd',
            padding: '15px 0'
          }}>
            <div style={{ 
              maxWidth: '1200px', 
              margin: '0 auto', 
              padding: '0 20px' 
            }}>
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                margin: 0 
              }}>AI Helpdesk</h1>
            </div>
          </header>
          <main style={{ 
            flex: 1, 
            padding: '20px' 
          }}>
            {children}
          </main>
          <footer style={{ 
            backgroundColor: '#fff', 
            borderTop: '1px solid #ddd', 
            padding: '15px 0',
            textAlign: 'center'
          }}>
            <div style={{ 
              maxWidth: '1200px', 
              margin: '0 auto', 
              padding: '0 20px' 
            }}>
              <p style={{ 
                fontSize: '14px', 
                color: '#666', 
                margin: 0 
              }}>
                AI Helpdesk with Knowledge Base
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
