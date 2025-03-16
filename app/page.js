import ChatUI from './components/ChatUI';

export default function Home() {
  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      height: 'calc(100vh - 130px)' 
    }}>
      <ChatUI />
    </div>
  );
}
