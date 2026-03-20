import { useState, useEffect, useMemo } from 'react';
import { supabase, StudentWithTicket, EventSettings } from '../lib/supabase';
import { Mail, Settings as SettingsIcon, UserPlus, RefreshCw, Search, Trash2, CheckSquare, Square, ChevronUp, ChevronDown, Layers, BarChart3 } from 'lucide-react';
import EventSettingsModal from './EventSettingsModal';
import AddStudentModal from './AddStudentModal';

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [students, setStudents] = useState<StudentWithTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTicket, setSendingTicket] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);

  const [sortField, setSortField] = useState<'name' | 'roll_number'>('roll_number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupYear, setNewGroupYear] = useState('N/A');
  const [newGroupSec, setNewGroupSec] = useState('N/A');

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

  const groupStats = useMemo(() => {
    const groups: Record<string, { total: number; invited: number }> = {};
    students.forEach(s => {
      const gName = s.group_name || 'Unassigned';
      if (!groups[gName]) groups[gName] = { total: 0, invited: 0 };
      groups[gName].total++;
      if (s.ticket?.status === 'sent' || s.ticket?.status === 'checked_in') groups[gName].invited++;
    });
    return groups;
  }, [students]);

  // --- IMPROVED SMART SORTING LOGIC ---
  const filteredAndSortedStudents = useMemo(() => {
    let result = students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            s.roll_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = groupFilter === 'all' || s.group_name === groupFilter;
      return matchesSearch && matchesGroup;
    });

    return result.sort((a, b) => {
      // Use the actual selected sortField (name or roll_number)
      const valA = String(a[sortField] || '').toLowerCase();
      const valB = String(b[sortField] || '').toLowerCase();
      
      if (sortOrder === 'asc') {
        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      } else {
        return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
      }
    });
  }, [students, searchTerm, groupFilter, sortField, sortOrder]);

  const toggleSort = (field: 'name' | 'roll_number') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleBulkGroup = async () => {
    if (!newGroupName) return alert("Please enter a group name");
    setLoading(true);
    const { error } = await supabase
      .from('students')
      .update({ group_name: newGroupName, year: newGroupYear, section: newGroupSec })
      .in('id', selectedIds);

    if (!error) {
      setSelectedIds([]);
      setShowGroupModal(false);
      setNewGroupName('');
      loadData();
    }
    setLoading(false);
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
      }
    } finally {
      setSendingTicket(null);
    }
  };

  if (!session && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form onSubmit={(e) => { e.preventDefault(); supabase.auth.signInWithPassword({ email, password }); }} className="bg-white p-10 rounded-[2rem] shadow-xl max-w-md w-full border border-gray-100 font-sans">
          <h1 className="text-3xl font-black text-center mb-8 italic tracking-tighter">ADMIN ACCESS</h1>
          <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} className="w-full px-5 py-4 bg-gray-50 rounded-2xl mb-4 outline-none border-none font-bold" />
          <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} className="w-full px-5 py-4 bg-gray-50 rounded-2xl mb-8 outline-none border-none font-bold" />
          <button type="submit" className="w-full bg-black text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-gray-800 transition">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] pb-20 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Progress Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
          <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h2 className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">
              <BarChart3 size={16}/> Group Progress Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(groupStats).map(([name, stat]) => {
                const percent = Math.round((stat.invited / stat.total) * 100) || 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                      <span className="text-gray-600">{name} ({stat.total})</span>
                      <span className="text-blue-600">{percent}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all duration-700" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-black p-8 rounded-[2.5rem] flex flex-col justify-center text-white">
            <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Total Invited</p>
            <h3 className="text-6xl font-black italic tracking-tighter">
              {Math.round((students.filter(s => s.ticket?.status === 'sent' || s.ticket?.status === 'checked_in').length / students.length) * 100) || 0}%
            </h3>
            <p className="text-[10px] font-bold mt-4 opacity-60">
              {students.filter(s => s.ticket?.status === 'sent' || s.ticket?.status === 'checked_in').length} / {students.length} students live.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Search members..." className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-sm border-none outline-none font-bold text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <select className="bg-white px-5 py-4 rounded-2xl shadow-sm border-none font-black text-[10px] text-gray-500 uppercase outline-none" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
               <option value="all">All Groups</option>
               {Object.keys(groupStats).map(g => <option key={g} value={g}>{g.toUpperCase()}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <button onClick={() => setShowGroupModal(true)} className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-100">
                <Layers size={16}/> Create Group ({selectedIds.length})
              </button>
            )}
            <button onClick={() => setShowAddStudent(true)} className="bg-black text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-gray-800 transition">Add Student</button>
            <button onClick={loadData} className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-400 hover:text-black transition"><RefreshCw size={18}/></button>
          </div>
        </div>

        {/* --- TABLE WITH TWO SORTABLE HEADERS --- */}
        <div className="bg-white rounded-[3rem] shadow-2xl shadow-gray-200/50 border border-gray-50 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="p-8 w-12 text-center">
                  <button onClick={() => setSelectedIds(selectedIds.length === filteredAndSortedStudents.length ? [] : filteredAndSortedStudents.map(s => s.id))}>
                    {selectedIds.length === filteredAndSortedStudents.length && filteredAndSortedStudents.length > 0 ? <CheckSquare className="text-blue-600"/> : <Square className="text-gray-200"/>}
                  </button>
                </th>
                <th className="p-8 cursor-pointer group" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                    Student / ID {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                  </div>
                </th>
                <th className="p-8 cursor-pointer group" onClick={() => toggleSort('roll_number')}>
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                    Group / Categorization {sortField === 'roll_number' && (sortOrder === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}
                  </div>
                </th>
                <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Status</th>
                <th className="p-8 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredAndSortedStudents.map(s => (
                <tr key={s.id} className={selectedIds.includes(s.id) ? 'bg-blue-50/40' : 'hover:bg-gray-50/30 transition-all'}>
                  <td className="p-8 text-center">
                    <button onClick={() => setSelectedIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}>
                      {selectedIds.includes(s.id) ? <CheckSquare className="text-blue-600" size={22}/> : <Square className="text-gray-200" size={22}/>}
                    </button>
                  </td>
                  <td className="p-8">
                    <p className="font-black text-gray-900 uppercase text-sm">{s.name}</p>
                    <p className="text-[10px] text-gray-300 font-black mt-1 uppercase">{s.roll_number}</p>
                  </td>
                  <td className="p-8">
                    <p className={`text-[10px] font-black uppercase ${s.group_name === 'Unassigned' ? 'text-gray-200 italic' : 'text-gray-700'}`}>{s.group_name || 'Unassigned'}</p>
                    <p className="text-[9px] font-bold text-blue-500 uppercase mt-1 opacity-50">Yr {s.year} • Sec {s.section}</p>
                  </td>
                  <td className="p-8">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      s.ticket?.status === 'sent' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                      s.ticket?.status === 'checked_in' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                    }`}>
                      {s.ticket?.status || 'No Ticket'}
                    </span>
                  </td>
                  <td className="p-8 text-right">
                    <button 
                      onClick={() => sendTicket(s)}
                      disabled={sendingTicket === s.id}
                      className="bg-gray-900 text-white p-3 rounded-2xl shadow-lg shadow-gray-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Mail size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal logic remains same... */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-md w-full border border-white/20 shadow-2xl">
            <h2 className="text-3xl font-black italic tracking-tighter mb-2">NEW GROUP</h2>
            <div className="space-y-6 mt-8">
              <input type="text" placeholder="Group Name" className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none outline-none font-bold text-gray-700" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none" value={newGroupYear} onChange={e => setNewGroupYear(e.target.value)}>
                  <option value="N/A">N/A</option><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option>
                </select>
                <select className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none font-bold text-sm outline-none" value={newGroupSec} onChange={e => setNewGroupSec(e.target.value)}>
                  <option value="N/A">N/A</option><option value="A">Sec A</option><option value="B">Sec B</option><option value="C">Sec C</option><option value="D">Sec D</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowGroupModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl uppercase text-[10px]">Cancel</button>
              <button onClick={handleBulkGroup} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] shadow-xl shadow-blue-100">Finalize</button>
            </div>
          </div>
        </div>
      )}
      {showAddStudent && <AddStudentModal onClose={() => setShowAddStudent(false)} onAdd={loadData} />}
    </div>
  );
}