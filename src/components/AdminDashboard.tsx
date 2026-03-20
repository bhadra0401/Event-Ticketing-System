import { useState, useEffect, useMemo } from 'react';
import { supabase, StudentWithTicket, EventSettings } from '../lib/supabase';
import { Mail, Settings as SettingsIcon, UserPlus, RefreshCw, Search, Trash2, CheckSquare, Square, ChevronUp, ChevronDown } from 'lucide-react';
import EventSettingsModal from './EventSettingsModal';
import AddStudentModal from './AddStudentModal';

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [students, setStudents] = useState<StudentWithTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTicket, setSendingTicket] = useState<string | null>(null);

  // Filter & Sort States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [sortField, setSortField] = useState<'name' | 'roll_number'>('roll_number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadData();
      else setLoading(false);
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsRes, settingsRes] = await Promise.all([
        supabase.from('students').select('*, ticket:tickets(*)'),
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

  // --- FILTER & SORT LOGIC ---
  const filteredAndSortedStudents = useMemo(() => {
    let result = students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            s.roll_number.toLowerCase().includes(searchTerm.toLowerCase());
      const currentStatus = s.ticket?.status || 'pending';
      const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;
      const matchesYear = yearFilter === 'all' || s.year === yearFilter;
      const matchesSection = sectionFilter === 'all' || s.section === sectionFilter;
      return matchesSearch && matchesStatus && matchesYear && matchesSection;
    });

    return result.sort((a, b) => {
      const valA = (a[sortField] || '').toLowerCase();
      const valB = (b[sortField] || '').toLowerCase();
      if (sortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
  }, [students, searchTerm, statusFilter, yearFilter, sectionFilter, sortField, sortOrder]);

  const toggleSort = (field: 'name' | 'roll_number') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedStudents.map(s => s.id));
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.length} students?`)) return;
    setLoading(true);
    try {
      await supabase.from('tickets').delete().in('student_id', selectedIds);
      await supabase.from('students').delete().in('id', selectedIds);
      setSelectedIds([]);
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const sendTicket = async (student: StudentWithTicket) => {
    setSendingTicket(student.id);
    try {
      let currentTicketId = student.ticket?.id;
      if (!currentTicketId) {
        const { data: newTicket } = await supabase.from('tickets').insert({
          student_id: student.id,
          qr_hash: crypto.randomUUID(),
          status: 'pending'
        }).select().single();
        currentTicketId = newTicket?.id;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ email: student.email, name: student.name, ticketId: currentTicketId })
      });

      if (response.ok) {
        await supabase.from('tickets').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', currentTicketId);
        await loadData();
        alert('Ticket sent!');
      }
    } finally {
      setSendingTicket(null);
    }
  };

  if (!session && !loading) {
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
    <div className="min-h-screen bg-[#fcfcfd] pb-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic">MANAGEMENT SUITE</h1>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Managing {students.length} Members</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.length > 0 && (
              <button onClick={deleteSelected} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm shadow-lg animate-pulse">
                <Trash2 size={18}/> Delete ({selectedIds.length})
              </button>
            )}
            <button onClick={() => setShowAddStudent(true)} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition"><UserPlus size={18}/> Add Student</button>
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition"><SettingsIcon size={18}/> Settings</button>
            <button onClick={loadData} className="p-2 bg-white border border-gray-200 rounded-xl shadow-sm text-gray-600"><RefreshCw size={18}/></button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" placeholder="Search name/roll..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-gray-50 border-none rounded-2xl py-3 px-4 font-bold text-gray-600 outline-none">
              <option value="all">ANY STATUS</option>
              <option value="sent">SENT</option>
              <option value="pending">PENDING</option>
              <option value="checked_in">CHECKED IN</option>
            </select>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="bg-gray-50 border-none rounded-2xl py-3 px-4 font-bold text-gray-600 outline-none">
              <option value="all">ALL YEARS</option>
              <option value="1">1st YEAR</option>
              <option value="2">2nd YEAR</option>
              <option value="3">3rd YEAR</option>
              <option value="4">4th YEAR</option>
              <option value="Other">GUESTS</option>
            </select>
            <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className="bg-gray-50 border-none rounded-2xl py-3 px-4 font-bold text-gray-600 outline-none">
              <option value="all">ALL SECTIONS</option>
              <option value="A">SECTION A</option>
              <option value="B">SECTION B</option>
              <option value="C">SECTION C</option>
              <option value="D">SECTION D</option>
              <option value="NA">N/A</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 w-12">
                    <button onClick={toggleSelectAll}>
                      {selectedIds.length === filteredAndSortedStudents.length && filteredAndSortedStudents.length > 0 ? <CheckSquare className="text-blue-600"/> : <Square className="text-gray-300"/>}
                    </button>
                  </th>
                  <th className="px-6 py-5 cursor-pointer" onClick={() => toggleSort('name')}>
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Student Name {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                    </div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer" onClick={() => toggleSort('roll_number')}>
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Roll / Year / Sec {sortField === 'roll_number' && (sortOrder === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                    </div>
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAndSortedStudents.map((student) => (
                  <tr key={student.id} className={`hover:bg-blue-50/30 transition-all ${selectedIds.includes(student.id) ? 'bg-blue-50/60' : ''}`}>
                    <td className="px-6 py-5">
                      <button onClick={() => setSelectedIds(prev => prev.includes(student.id) ? prev.filter(i => i !== student.id) : [...prev, student.id])}>
                        {selectedIds.includes(student.id) ? <CheckSquare size={22} className="text-blue-600"/> : <Square size={22} className="text-gray-200"/>}
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-black text-gray-900 uppercase text-sm">{student.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{student.email}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-mono text-xs font-black text-gray-700">{student.roll_number}</p>
                      <p className="text-[9px] font-black text-blue-500 uppercase mt-1">Yr {student.year || '1'} • Sec {student.section || 'A'}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        (student.ticket?.status || 'pending') === 'checked_in' ? 'bg-green-50 border-green-200 text-green-600' :
                        (student.ticket?.status || 'pending') === 'sent' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}>
                        {student.ticket?.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => sendTicket(student)}
                        disabled={!!sendingTicket}
                        className="p-2 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Mail size={16} />
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