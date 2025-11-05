import { Dashboard } from './components/Dashboard';
import { ChatWidget } from './components/ChatWidget';
import { ChatProvider } from './contexts/ChatContext';

function App() {
  return (
    <ChatProvider>
      <Dashboard />
      <ChatWidget />
    </ChatProvider>
  );
}

export default App;
