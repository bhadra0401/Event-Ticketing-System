import { useState, useEffect } from 'react';
import { supabase, StudentWithTicket, EventSettings } from '../lib/supabase';
import { Mail, Settings as SettingsIcon, UserPlus, RefreshCw, Search, Users, CheckCircle, Clock, Trash2, CheckSquare, Square } from 'lucide-react';
import EventSettingsModal from './EventSettingsModal';
import AddStudentModal from './AddStudentModal';

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [students, setStudents] = useState<StudentWithTicket[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // Track selected students
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

  const loadData = async () => {
    try {
      const [studentsRes, settingsRes] = await Promise.all([
        supabase.from('students').select('*, ticket:tickets(*)').order('roll_number'),
        supabase.from('event_settings').select('*').limit(1).maybeSingle()
      ]);

      if (studentsRes.data) {
        setStudents(studentsRes.data.map(s => ({
          ...s,
          ticket: Array.isArray(s.ticket) ? s.ticket[0] || null : s.ticket
        })));
      }
      if (settingsRes.data) setEventSettings(settingsRes.data);
    } finally {
      setLoading(false);
    }
  };

  // --- SELECTION LOGIC ---
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteSelected = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected students? This cannot be undone.`)) return;
    
    setLoading(true);
    try {
      // Step 1: Delete associated tickets first (Database integrity)
      await supabase.from('tickets').delete().in('student_id', selectedIds);
      
      // Step 2: Delete students
      const { error } = await supabase.from('students').delete().in('id', selectedIds);
      
      if (error) throw error;
      
      setSelectedIds([]);
      await loadData();
      alert('Successfully deleted selected students.');
    } catch (err) {
      alert('Error deleting students.');
    } finally {
      setLoading(false);
    }
  };

  const sendTicket = async (student: StudentWithTicket) => {
    setSendingTicket(student.id);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ email: student.email, name: student.name, ticketId: student.ticket?.id })
      });
      if (!response.ok) throw new Error();
      await supabase.from('tickets').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', student.ticket?.id);
      await loadData();
      alert('Ticket sent!');
    } catch (err) {
      alert('Failed to send.');
    } finally {
      setSendingTicket(null);
    }
  };

  const stats = {
    total: students.length,
    invited: students.filter(s => s.ticket?.status === 'sent' || s.ticket?.status === 'checked_in').length,
    pending: students.filter(s => !s.ticket || s.ticket.status === 'pending').length
  };

  if (loading && students.length === 0) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold">LOADING...</div>;

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form onSubmit={(e) => { e.preventDefault(); supabase.auth.signInWithPassword({ email, password }); }} className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-200">
          <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
          <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg mb-4 outline-none" />
          <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg mb-6 outline-none" />
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight italic">ADMIN PANEL</h1>
            <p className="text-gray-500 font-medium">Managing {stats.total} Active Students</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.length > 0 && (
              <button onClick={deleteSelected} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm transition shadow-lg animate-bounce">
                <Trash2 size={18}/> Delete ({selectedIds.length})
              </button>
            )}
            <button onClick={() => setShowAddStudent(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-sm transition"><UserPlus size={18}/> Add Student</button>
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm transition"><SettingsIcon size={18}/> Settings</button>
            <button onClick={loadData} className="p-2 bg-white border border-gray-200 rounded-lg"><RefreshCw size={18}/></button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl font-black text-xl">{stats.total}</div>
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Total Members</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="p-4 bg-green-50 text-green-600 rounded-2xl font-black text-xl">{stats.invited}</div>
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Invited</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="p-4 bg-yellow-50 text-yellow-600 rounded-2xl font-black text-xl">{stats.pending}</div>
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Pending</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" placeholder="Search by name or roll number..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <button onClick={toggleSelectAll} className="text-blue-600">
                      {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 ? <CheckSquare size={20}/> : <Square size={20}/>}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Student Info</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className={`hover:bg-blue-50/30 transition ${selectedIds.includes(student.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4">
                      <button onClick={() => toggleSelectOne(student.id)} className="text-gray-400">
                        {selectedIds.includes(student.id) ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-black text-gray-900 uppercase text-sm">{student.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{student.roll_number}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] rounded font-bold uppercase ${
                        student.ticket?.status === 'checked_in' ? 'bg-green-100 text-green-700' :
                        student.ticket?.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {student.ticket?.status || 'no ticket'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => sendTicket(student)}
                        disabled={sendingTicket === student.id}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-700 transition uppercase disabled:opacity-50"
                      >
                        {sendingTicket === student.id ? 'SENDING...' : 'SEND TICKET'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showSettings && eventSettings && (
        <EventSettingsModal settings={eventSettings} onClose={() => setShowSettings(false)} onUpdate={loadData} />
      )}
      {showAddStudent && (
        <AddStudentModal onClose={() => setShowAddStudent(false)} onAdd={loadData} />
      )}
    </div>
  );
}