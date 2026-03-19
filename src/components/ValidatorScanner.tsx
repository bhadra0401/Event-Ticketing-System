import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Camera, AlertTriangle, Users, Clock, LogOut, ShieldAlert, Activity, History, Search, UserCheck } from 'lucide-react';

type ValidationResult = {
  type: 'success' | 'duplicate' | 'invalid';
  message: string;
  studentName?: string;
  rollNumber?: string;
  checkInTime?: string;
};

type EventStats = {
  total: number;
  checkedIn: number;
  pending: number;
};

type ScanActivity = {
  id: string;
  name: string;
  roll: string;
  time: string;
  status: 'success' | 'duplicate';
};

export default function ValidatorScanner() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // Metrics & Search
  const [stats, setStats] = useState<EventStats>({ total: 0, checkedIn: 0, pending: 0 });
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionDuplicates, setSessionDuplicates] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ScanActivity[]>([]);

  // Scanner State
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadInitialData();
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadInitialData();
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadInitialData = async () => {
    fetchStats();
    const { data } = await supabase.from('students').select('*, ticket:tickets(*)');
    if (data) setStudents(data);
  };

  const fetchStats = async () => {
    const { data } = await supabase.from('tickets').select('status');
    if (data) {
      setStats({
        total: data.length,
        checkedIn: data.filter(t => t.status === 'checked_in').length,
        pending: data.filter(t => t.status !== 'checked_in').length
      });
    }
  };

  const addActivity = (name: string, roll: string, status: 'success' | 'duplicate') => {
    const newActivity: ScanActivity = {
      id: crypto.randomUUID(),
      name, roll, time: new Date().toLocaleTimeString(), status
    };
    setRecentActivity(prev => [newActivity, ...prev].slice(0, 5));
  };

  const startScanning = async () => {
    setScanning(true);
    setTimeout(async () => {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;
      try {
        await html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, onScanSuccess, () => {});
      } catch (err) {
        const devices = await Html5Qrcode.getCameras();
        if (devices.length > 0) await html5QrCode.start(devices[0].id, { fps: 10, qrbox: 250 }, onScanSuccess, () => {});
      }
    }, 100);
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      setScanning(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    await stopScanning();
    try {
      const { ticketId, qrHash } = JSON.parse(decodedText);
      processCheckIn(ticketId, qrHash);
    } catch (err) {
      showValidationResult({ type: 'invalid', message: 'INVALID QR' });
    }
  };

  const processCheckIn = async (ticketId: string, qrHash?: string, isManual = false) => {
    const query = supabase.from('tickets').select('*, student:students(*)').eq('id', ticketId);
    if (qrHash) query.eq('qr_hash', qrHash);
    const { data: ticket } = await query.single();

    if (!ticket) {
      showValidationResult({ type: 'invalid', message: 'NOT FOUND' });
      return;
    }

    const name = ticket.student.name;
    const roll = ticket.student.roll_number;

    if (ticket.status === 'checked_in') {
      setSessionDuplicates(p => p + 1);
      addActivity(name, roll, 'duplicate');
      showValidationResult({ type: 'duplicate', message: 'ALREADY IN', studentName: name, rollNumber: roll, checkInTime: ticket.checked_in_at });
      return;
    }

    await supabase.from('tickets').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', ticketId);
    fetchStats();
    addActivity(name, roll, 'success');
    showValidationResult({ type: 'success', message: isManual ? 'MANUAL ENTRY' : 'GRANTED', studentName: name, rollNumber: roll });
  };

  const showValidationResult = (validationResult: ValidationResult) => {
    setResult(validationResult);
    setShowResult(true);
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = setTimeout(() => {
      setShowResult(false);
      setResult(null);
      if (scanning) startScanning(); 
    }, 3500);
  };

  const attendancePercentage = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;
  const filteredStudents = students.filter(s => 
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.roll_number.toLowerCase().includes(searchTerm.toLowerCase())) &&
    s.ticket?.status !== 'checked_in'
  ).slice(0, 5);

  if (authLoading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">LOADING...</div>;

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <form onSubmit={(e) => { e.preventDefault(); supabase.auth.signInWithPassword({ email, password }); }} className="bg-gray-900 p-8 rounded-2xl w-full max-w-md border border-gray-800">
          <h1 className="text-white text-2xl font-bold mb-6 text-center">VALIDATOR LOGIN</h1>
          <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} className="w-full p-3 mb-4 rounded-xl bg-gray-950 text-white border border-gray-800 outline-none" />
          <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} className="w-full p-3 mb-6 rounded-xl bg-gray-950 text-white border border-gray-800 outline-none" />
          <button className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">AUTHENTICATE</button>
        </form>
      </div>
    );
  }

  if (showResult && result) {
    return (
      <div className={`${result.type === 'success' ? 'bg-green-600' : 'bg-red-600'} min-h-screen flex items-center justify-center p-4 animate-pulse z-50 fixed inset-0`}>
        <div className="text-center text-white">
          <h1 className="text-6xl font-black mb-4 tracking-tighter">{result.message}</h1>
          <p className="text-4xl font-bold">{result.studentName}</p>
          <p className="text-xl font-mono opacity-80 mt-2">{result.rollNumber}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col lg:flex-row font-sans">
      {/* SCANNER & SEARCH COLUMN */}
      <div className="lg:w-1/2 p-6 flex flex-col border-r border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black tracking-tight italic">SECURITY PORTAL</h2>
          <button onClick={() => supabase.auth.signOut()} className="p-2 text-gray-500 hover:text-white"><LogOut size={20}/></button>
        </div>

        {/* SEARCH BAR */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" placeholder="Manual Search (Name/Roll)..." 
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl outline-none"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm.length > 1 && filteredStudents.length > 0 && (
            <div className="absolute w-full mt-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden z-10 shadow-2xl">
              {filteredStudents.map(s => (
                <button key={s.id} onClick={() => { setSearchTerm(''); processCheckIn(s.ticket.id, undefined, true); }} className="w-full p-4 text-left flex justify-between items-center border-b border-gray-800 hover:bg-gray-800 transition">
                  <div><p className="font-bold text-sm uppercase">{s.name}</p><p className="text-xs text-gray-500">{s.roll_number}</p></div>
                  <UserCheck className="text-blue-500" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          {!scanning ? (
            <button onClick={startScanning} className="w-64 h-64 bg-blue-600/10 border-2 border-blue-600 border-dashed rounded-full flex flex-col items-center justify-center gap-4 hover:bg-blue-600/20 transition">
              <Camera size={48} className="text-blue-500" />
              <span className="font-bold text-blue-500">START SCANNER</span>
            </button>
          ) : (
            <div className="w-full max-w-sm">
              <div id="qr-reader" className="rounded-2xl overflow-hidden border-2 border-gray-800 bg-black h-[300px]"></div>
              <button onClick={stopScanning} className="w-full mt-4 py-3 bg-red-600/10 text-red-500 font-bold rounded-xl">CANCEL</button>
            </div>
          )}
        </div>
      </div>

      {/* STATS COLUMN */}
      <div className="lg:w-1/2 p-6 bg-gray-900">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-400 uppercase tracking-widest"><Activity size={20} /> Telemetry</h3>
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="col-span-2 bg-gray-950 border border-gray-800 rounded-3xl p-6 flex items-center justify-between">
            <div><p className="text-5xl font-black">{attendancePercentage}%</p><p className="text-xs text-green-400 font-bold mt-1 tracking-widest uppercase">Capacity</p></div>
            <div className="w-24 h-24">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#111827" strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${attendancePercentage}, 100`} />
              </svg>
            </div>
          </div>
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 text-center">
            <p className="text-2xl font-black text-yellow-500">{stats.pending}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Expected</p>
          </div>
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 text-center">
            <p className="text-2xl font-black text-red-500">{sessionDuplicates}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Violations</p>
          </div>
        </div>

        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-400 uppercase tracking-widest"><History size={20} /> Log</h3>
        <div className="space-y-3">
          {recentActivity.map((activity) => (
            <div key={activity.id} className={`flex justify-between p-4 rounded-xl bg-gray-950 border ${activity.status === 'success' ? 'border-green-900/30' : 'border-red-900/30'}`}>
              <div><p className="font-bold text-sm uppercase">{activity.name}</p><p className="text-[10px] text-gray-500">{activity.roll}</p></div>
              <div className="text-right">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${activity.status === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {activity.status === 'success' ? 'GRANTED' : 'DENIED'}
                </span>
                <p className="text-[10px] text-gray-600 mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}