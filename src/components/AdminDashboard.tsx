import { useState, useEffect, useMemo } from 'react';
import { supabase, StudentWithTicket, EventSettings } from '../lib/supabase';
import { Mail, Settings as SettingsIcon, UserPlus, RefreshCw, Search, Trash2, CheckSquare, Square, ChevronUp, ChevronDown, Layers, BarChart3, UserMinus, Edit3, RotateCcw, CheckCircle } from 'lucide-react';
import EventSettingsModal from './EventSettingsModal';
import AddStudentModal from './AddStudentModal';

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [students, setStudents] = useState<StudentWithTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTicket, setSendingTicket] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Sort
  const [sortField, setSortField] = useState<'name' | 'roll_number'>('roll_number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);

  // Group Form
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
      const { data: studentsData } = await supabase.from('students').select('*, ticket:tickets(*)');
      const { data: settingsData } = await supabase.from('event_settings').select('*').limit(1).maybeSingle();
      
      if (studentsData) {
        setStudents(studentsData.map(s => ({
          ...s,
          ticket: Array.isArray(s.ticket) ? s.ticket[0] || null : s.ticket
        })));
      }
      if (settingsData) setEventSettings(settingsData);
    } finally {
      setLoading(false);
    }
  };

  const groupStats = useMemo(() => {
    const groups: Record<string, { total: number; invited: number }> = {};
    students.forEach(s => {
      const gName = (s.group_name || 'Unassigned').trim().toUpperCase();
      if (!groups[gName]) groups[gName] = { total: 0, invited: 0 };
      groups[gName].total++;
      if (s.ticket?.status === 'sent' || s.ticket?.status === 'checked_in') groups[gName].invited++;
    });
    return groups;
  }, [students]);

  const filteredAndSortedStudents = useMemo(() => {
    let result = students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.roll_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = groupFilter === 'all' || s.group_name.trim().toUpperCase() === groupFilter.trim().toUpperCase();
      const matchesYear = yearFilter === 'all' || s.year === yearFilter;
      const matchesSection = sectionFilter === 'all' || s.section === sectionFilter;
      const matchesStatus = statusFilter === 'all' || (s.ticket?.status || 'pending') === statusFilter;
      return matchesSearch && matchesGroup && matchesYear && matchesSection && matchesStatus;
    });

    return result.sort((a, b) => {
      const valA = String(a[sortField] || '').toLowerCase();
      const valB = String(b[sortField] || '').toLowerCase();
      return sortOrder === 'asc' 
        ? valA.localeCompare(valB, undefined, { numeric: true }) 
        : valB.localeCompare(valA, undefined, { numeric: true });
    });
  }, [students, searchTerm, groupFilter, yearFilter, sectionFilter, statusFilter, sortField, sortOrder]);

  const toggleSort = (field: 'name' | 'roll_number') => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const handleBulkGroupAction = async (mode: 'update' | 'remove') => {
    setLoading(true);
    const normalizedName = newGroupName.trim().toUpperCase();
    const updates = mode === 'update' 
      ? { group_name: normalizedName, year: newGroupYear, section: newGroupSec }
      : { group_name: 'UNASSIGNED', year: 'N/A', section: 'N/A' };

    const { error } = await supabase.from('students').update(updates).in('id', selectedIds);
    if (!error) {
      setSelectedIds([]);
      setShowGroupModal(false);
      setNewGroupName('');
      loadData();
    }
    setLoading(false);
  };

  const handleRenameGroup = async () => {
    if (groupFilter === 'all' || groupFilter === 'UNASSIGNED') return;
    const newName = prompt(`Enter new name for group "${groupFilter}":`, groupFilter);
    if (!newName || newName.trim().toUpperCase() === groupFilter.toUpperCase()) return;

    setLoading(true);
    const { error } = await supabase
      .from('students')
      .update({ group_name: newName.trim().toUpperCase() })
      .eq('group_name', groupFilter);

    if (!error) {
      setGroupFilter(newName.trim().toUpperCase());
      loadData();
    }
    setLoading(false);
  };

  const deactivateTicket = async (studentId: string) => {
    if (!confirm("Deactivate this ticket? The student will be blocked from accessing the ticket page.")) return;
    setLoading(true);
    await supabase.from('tickets').update({ status: 'pending' }).eq('student_id', studentId);
    loadData();
    setLoading(false);
  };

  const reactivateTicket = async (studentId: string) => {
    setLoading(true);
    await supabase.from('tickets').update({ status: 'sent' }).eq('student_id', studentId);
    loadData();
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
        loadData();
      }
    } finally {
      setSendingTicket(null);
    }
  };

  if (!session && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-center">
        <form onSubmit={(e) => { e.preventDefault(); supabase.auth.signInWithPassword({ email, password }); }} className="bg-white p-10 rounded-[2rem] shadow-xl max-w-md w-full border border-gray-100 font-sans">
          <h1 className="text-3xl font-black italic tracking-tighter mb-8 uppercase">Admin Access</h1>
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
            <h2 className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6"><BarChart3 size={16}/> Group Progress Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(groupStats).map(([name, stat]) => (
                <div key={name} className="cursor-pointer group" onClick={() => setGroupFilter(name)}>
                  <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                    <span className="text-gray-600 group-hover:text-blue-600 transition-colors">{name} ({stat.total})</span>
                    <span className="text-blue-600 font-mono">{stat.invited} / {stat.total}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full transition-all duration-700" style={{ width: `${(stat.invited/stat.total)*100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-black p-8 rounded-[2.5rem] flex flex-col justify-center text-white text-center">
            <h3 className="text-6xl font-black italic tracking-tighter">
              {students.filter(s => s.ticket?.status === 'sent' || s.ticket?.status === 'checked_in').length}
            </h3>
            <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mt-2">Tickets Active</p>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl text-xs font-bold outline-none border-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="flex gap-2">
            <select className="flex-1 bg-gray-50 px-4 py-3 rounded-xl font-black text-[10px] text-gray-500 uppercase outline-none" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
              <option value="all">Group: All</option>
              {Object.keys(groupStats).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {groupFilter !== 'all' && groupFilter !== 'UNASSIGNED' && (
              <button onClick={handleRenameGroup} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition shadow-sm"><Edit3 size={16} /></button>
            )}
          </div>

          <select className="bg-gray-50 px-4 py-3 rounded-xl font-black text-[10px] text-gray-500 uppercase outline-none" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
             <option value="all">Year: All</option>
             <option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option><option value="N/A">N/A</option>
          </select>

          <select className="bg-gray-50 px-4 py-3 rounded-xl font-black text-[10px] text-gray-500 uppercase outline-none" value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
             <option value="all">Section: All</option>
             <option value="A">Sec A</option><option value="B">Sec B</option><option value="C">Sec C</option><option value="D">Sec D</option><option value="N/A">N/A</option>
          </select>

          <select className="bg-gray-50 px-4 py-3 rounded-xl font-black text-[10px] text-gray-500 uppercase outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
             <option value="all">Status: All</option>
             <option value="sent">Sent</option><option value="pending">Pending</option><option value="checked_in">Checked In</option>
          </select>
        </div>

        {/* Management Buttons */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div className="flex flex-wrap gap-2">
            {selectedIds.length > 0 && (
              <>
                <button onClick={() => { setNewGroupName(groupFilter !== 'all' ? groupFilter : ''); setShowGroupModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-100 active:scale-95 transition-all">
                  <Layers size={16}/> Group/Update ({selectedIds.length})
                </button>
                <button onClick={() => handleBulkGroupAction('remove')} className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase border border-red-100 hover:bg-red-100 transition">
                  <UserMinus size={16}/> Remove from Group
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddStudent(true)} className="bg-black text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-gray-800 transition">Add Student</button>
            <button onClick={loadData} className="p-3 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-black transition shadow-sm"><RefreshCw size={18}/></button>
          </div>
        </div>

        {/* Student Table */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-50 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100 font-black text-[10px] uppercase text-gray-400">
              <tr>
                <th className="p-8 w-12 text-center">
                  <button onClick={() => setSelectedIds(selectedIds.length === filteredAndSortedStudents.length ? [] : filteredAndSortedStudents.map(s => s.id))}>
                    {selectedIds.length === filteredAndSortedStudents.length && filteredAndSortedStudents.length > 0 ? <CheckSquare className="text-blue-600"/> : <Square className="text-gray-200"/>}
                  </button>
                </th>
                <th className="p-8 cursor-pointer group" onClick={() => toggleSort('name')}>Student {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}</th>
                <th className="p-8 cursor-pointer group" onClick={() => toggleSort('roll_number')}>Group Details {sortField === 'roll_number' && (sortOrder === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}</th>
                <th className="p-8">Status</th>
                <th className="p-8 text-right text-gray-400 font-black text-[9px] uppercase tracking-widest">Manage Ticket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredAndSortedStudents.map(s => (
                <tr key={s.id} className={selectedIds.includes(s.id) ? 'bg-blue-50/40' : 'hover:bg-gray-50/30 transition-all'}>
                  <td className="p-8 text-center"><button onClick={() => setSelectedIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}>{selectedIds.includes(s.id) ? <CheckSquare className="text-blue-600" size={20}/> : <Square className="text-gray-200" size={20}/>}</button></td>
                  <td className="p-8 font-black text-gray-900 uppercase text-xs tracking-tight">{s.name}<br/><span className="text-[10px] text-gray-300">{s.roll_number}</span></td>
                  <td className="p-8"><span className="text-[10px] font-black uppercase text-gray-700">{s.group_name}</span><br/><span className="text-[9px] font-bold text-blue-500 uppercase opacity-50">Yr {s.year} • Sec {s.section}</span></td>
                  <td className="p-8">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-widest ${
                      s.ticket?.status === 'sent' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                      s.ticket?.status === 'checked_in' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                    }`}>
                      {s.ticket?.status || 'No Ticket'}
                    </span>
                  </td>
                  <td className="p-8 text-right">
                    <div className="flex gap-2 justify-end">
                      {/* Reactivate Button (Green Check) - Show if Pending and has a ticket record */}
                      {s.ticket?.status === 'pending' && s.ticket?.id && (
                        <button 
                          onClick={() => reactivateTicket(s.id)}
                          className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition shadow-sm"
                          title="Reactivate Access (No Email)"
                        >
                          <CheckCircle size={16}/>
                        </button>
                      )}
                      
                      {/* Deactivate Button (Red Rotate) - Show if Active */}
                      {(s.ticket?.status === 'sent' || s.ticket?.status === 'checked_in') && (
                        <button 
                          onClick={() => deactivateTicket(s.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition shadow-sm"
                          title="Block/Deactivate Ticket"
                        >
                          <RotateCcw size={16}/>
                        </button>
                      )}

                      <button onClick={() => sendTicket(s)} disabled={sendingTicket === s.id} className="bg-gray-900 text-white p-3 rounded-xl shadow-lg hover:scale-110 disabled:opacity-30 transition-all">
                        <Mail size={16}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-md w-full shadow-2xl border border-white/20">
            <h2 className="text-2xl font-black italic mb-2 uppercase text-gray-900 tracking-tighter">Assign Group</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Group Label" className="w-full px-6 py-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm border-none focus:ring-2 focus:ring-blue-500" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full px-6 py-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border-none" value={newGroupYear} onChange={e => setNewGroupYear(e.target.value)}>
                  <option value="N/A">Year N/A</option><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option>
                </select>
                <select className="w-full px-6 py-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border-none" value={newGroupSec} onChange={e => setNewGroupSec(e.target.value)}>
                  <option value="N/A">Sec N/A</option><option value="A">Sec A</option><option value="B">Sec B</option><option value="C">Sec C</option><option value="D">Sec D</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowGroupModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-black rounded-2xl uppercase text-[10px] tracking-widest">Cancel</button>
              <button onClick={() => handleBulkGroupAction('update')} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100">Apply Changes</button>
            </div>
          </div>
        </div>
      )}
      {showAddStudent && <AddStudentModal onClose={() => setShowAddStudent(false)} onAdd={loadData} />}
    </div>
  );
}