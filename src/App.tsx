import { ChatWidget } from './components/ChatWidget';
import { ChatProvider } from './contexts/ChatContext';

function App() {
  return (
    <ChatProvider>
      <div className="min-h-screen relative overflow-hidden bg-transparent">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(25,118,210,0.16),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.6),_transparent_70%)]" />
        </div>
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}

export default App;
