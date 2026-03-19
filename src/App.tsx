import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import AdminDashboard from './components/AdminDashboard';
import TicketView from './components/TicketView';
import ValidatorScanner from './components/ValidatorScanner';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/ticket/:ticketId" element={<TicketView />} />
        <Route path="/validator" element={<ValidatorScanner />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
