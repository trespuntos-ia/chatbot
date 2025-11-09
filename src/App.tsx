import { ChatWidget } from './components/ChatWidget';
import { ChatProvider } from './contexts/ChatContext';

function App() {
  return (
    <ChatProvider>
      <div className="min-h-screen bg-[#f5f6f8]">
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}

export default App;
