import { useState, useEffect } from 'react';
import { supabase, StudentWithTicket, EventSettings } from '../lib/supabase';
import { Mail, Settings as SettingsIcon, UserPlus, RefreshCw, Database, Search, Users, CheckCircle, Clock } from 'lucide-react';
import EventSettingsModal from './EventSettingsModal';
import AddStudentModal from './AddStudentModal';
import { insertSampleData } from '../utils/sampleData';

export default function AdminDashboard() {
  // Authentication State
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard State
  const [students, setStudents] = useState<StudentWithTicket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingTicket, setSendingTicket] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadData();
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadData();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
    setLoading(false);
  };

  const loadData = async () => {
    try {
      const [studentsRes, settingsRes] = await Promise.all([
        supabase
          .from('students')
          .select('*, ticket:tickets(*)')
          .order('roll_number'),
        supabase
          .from('event_settings')
          .select('*')
          .limit(1)
          .maybeSingle()
      ]);

      if (studentsRes.data) {
        const formattedStudents = studentsRes.data.map(student => ({
          ...student,
          ticket: Array.isArray(student.ticket)
            ? student.ticket[0] || null
            : student.ticket
        }));
        setStudents(formattedStudents);
      }

      if (settingsRes.data) {
        setEventSettings(settingsRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTicket = async (student: StudentWithTicket) => {
    setSendingTicket(student.id);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-ticket`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            email: student.email,
            name: student.name,
            ticketId: student.ticket?.id
          })
        }
      );

      if (!response.ok) throw new Error('Failed to send email');

      await supabase
        .from('tickets')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', student.ticket?.id);

      await loadData();
      alert('Ticket sent successfully!');
    } catch (error) {
      console.error('Error sending ticket:', error);
      alert('Failed to send ticket email');
    } finally {
      setSendingTicket(null);
    }
  };

  // Filter Logic
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats Logic
  const stats = {
    total: students.length,
    invited: students.filter(s => s.ticket?.status === 'sent' || s.ticket?.status === 'checked_in').length,
    pending: students.filter(s => !s.ticket || s.ticket.status === 'pending').length
  };

  const getStatusBadge = (student: StudentWithTicket) => {
    if (!student.ticket) return <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700">No Ticket</span>;
    switch (student.ticket.status) {
      case 'checked_in': return <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 font-bold">Checked In</span>;
      case 'sent': return <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 font-bold">Sent</span>;
      default: return <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 font-bold">Pending</span>;
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold">LOADING...</div>;

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-200">
          <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
          {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{loginError}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none" />
            <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none" />
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">COMMAND CENTER</h1>
            <p className="text-gray-500 font-medium">Manage invitations for {stats.total} students</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAddStudent(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-sm transition shadow-sm"><UserPlus size={18}/> Add Student</button>
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm transition shadow-sm"><SettingsIcon size={18}/> Settings</button>
            <button onClick={loadData} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600 transition shadow-sm"><RefreshCw size={18}/></button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-8 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search student by name or roll number..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Users size={28}/></div>
            <div><p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total</p><p className="text-3xl font-black">{stats.total}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="p-4 bg-green-50 text-green-600 rounded-2xl"><CheckCircle size={28}/></div>
            <div><p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Invited</p><p className="text-3xl font-black text-green-600">{stats.invited}</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="p-4 bg-yellow-50 text-yellow-600 rounded-2xl"><Clock size={28}/></div>
            <div><p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Pending</p><p className="text-3xl font-black text-yellow-600">{stats.pending}</p></div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Student Info</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Email Address</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-6 py-4">
                      <p className="font-black text-gray-900 uppercase">{student.name}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{student.roll_number}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.email}</td>
                    <td className="px-6 py-4">{getStatusBadge(student)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => sendTicket(student)}
                        disabled={sendingTicket === student.id}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        <Mail size={14} /> {sendingTicket === student.id ? 'SENDING...' : 'SEND TICKET'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <div className="p-20 text-center text-gray-400 font-medium">No students found matching your search.</div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showSettings && eventSettings && (
        <EventSettingsModal settings={eventSettings} onClose={() => setShowSettings(false)} onUpdate={loadData} />
      )}
      {showAddStudent && (
        <AddStudentModal onClose={() => setShowAddStudent(false)} onAdd={loadData} />
      )}
    </div>
  );
}