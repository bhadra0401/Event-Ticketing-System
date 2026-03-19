import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Camera, AlertTriangle, Users, Clock, LogOut, ShieldAlert, Activity, History } from 'lucide-react';

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
  // Auth & Dashboard State
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // Metrics
  const [stats, setStats] = useState<EventStats>({ total: 0, checkedIn: 0, pending: 0 });
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
      if (session) fetchStats();
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchStats();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      stopScanning();
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await stopScanning();
    await supabase.auth.signOut();
  };

  const fetchStats = async () => {
    const { data, error } = await supabase.from('tickets').select('status');
    if (data && !error) {
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
      name,
      roll,
      time: new Date().toLocaleTimeString(),
      status
    };
    setRecentActivity(prev => [newActivity, ...prev].slice(0, 5)); // Keep last 5
  };

  const startScanning = async () => {
    try {
      setScanning(true);
      setTimeout(async () => {
        const html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        try {
          // Try forcing rear camera first
          await html5QrCode.start({ facingMode: 'environment' }, config, onScanSuccess, () => {});
        } catch (err) {
          console.warn("Strict rear camera failed, using iPhone fallback...", err);
          // Smart Fallback for iPhones
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            await html5QrCode.start(devices[0].id, config, onScanSuccess, () => {});
          } else {
            throw new Error("No cameras detected");
          }
        }
      }, 100);
    } catch (err) {
      console.error('Error starting scanner:', err);
      alert('Camera access denied. On iPhone, go to Settings -> Safari -> Camera and select "Allow".');
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      setScanning(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    try {
      await stopScanning();
      const qrData = JSON.parse(decodedText);
      const { ticketId, qrHash } = qrData;

      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*, student:students(*)')
        .eq('id', ticketId)
        .eq('qr_hash', qrHash)
        .maybeSingle();

      if (error || !ticket) {
        showValidationResult({ type: 'invalid', message: 'INVALID TICKET OR FAKE QR' });
        return;
      }

      const studentName = (ticket.student as any).name;
      const rollNumber = (ticket.student as any).roll_number;

      if (ticket.status === 'checked_in') {
        setSessionDuplicates(prev => prev + 1);
        addActivity(studentName, rollNumber, 'duplicate');
        showValidationResult({
          type: 'duplicate',
          message: 'DUPLICATE ENTRY',
          studentName,
          rollNumber,
          checkInTime: ticket.checked_in_at || undefined
        });
        return;
      }

      // Valid Ticket - Check them in
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      fetchStats();
      addActivity(studentName, rollNumber, 'success');

      showValidationResult({
        type: 'success',
        message: 'ACCESS GRANTED',
        studentName,
        rollNumber
      });
    } catch (err) {
      console.error('Error validating ticket:', err);
      showValidationResult({ type: 'invalid', message: 'CORRUPTED QR CODE' });
    }
  };

  const showValidationResult = (validationResult: ValidationResult) => {
    setResult(validationResult);
    setShowResult(true);
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    
    resultTimeoutRef.current = setTimeout(() => {
      setShowResult(false);
      setResult(null);
      startScanning(); // Auto-resume
    }, 3500);
  };

  // Calculate percentage for donut chart
  const attendancePercentage = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

  if (authLoading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white font-bold">LOADING SECURITY PROTOCOLS...</div>;

  // --- LOGIN SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.15)] max-w-md w-full border border-gray-800">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-600 bg-opacity-20 rounded-full">
              <ShieldAlert className="text-blue-500" size={40} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-white mb-6 tracking-wide">VALIDATOR SECURE LOGIN</h1>
          {loginError && <div className="bg-red-500 bg-opacity-10 text-red-500 p-3 rounded-lg mb-4 text-sm border border-red-500 text-center">{loginError}</div>}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <input type="email" required placeholder="Authorized Email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-950 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-950 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition tracking-wider shadow-lg shadow-blue-600/30">
              AUTHENTICATE
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- FLASHING RESULT SCREEN ---
  if (showResult && result) {
    const bgColor = result.type === 'success' ? 'bg-green-600' : 'bg-red-600';
    const Icon = result.type === 'success' ? CheckCircle : result.type === 'duplicate' ? AlertTriangle : XCircle;

    return (
      <div className={`${bgColor} min-h-screen flex items-center justify-center p-4 animate-pulse`}>
        <div className="text-center text-white">
          <Icon size={140} className="mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-6xl font-black mb-6 tracking-tighter">{result.message}</h1>
          {result.studentName && (
            <div className="bg-black bg-opacity-30 rounded-3xl p-8 backdrop-blur-md max-w-lg mx-auto border border-white border-opacity-20 shadow-2xl">
              <p className="text-sm uppercase tracking-widest opacity-80 mb-2">Guest Identifier</p>
              <p className="text-4xl font-bold mb-4">{result.studentName}</p>
              <p className="text-2xl font-mono bg-black bg-opacity-40 inline-block px-4 py-2 rounded-lg">{result.rollNumber}</p>
              
              {result.checkInTime && (
                <div className="mt-8 pt-6 border-t border-white border-opacity-20">
                  <p className="text-sm font-bold text-yellow-300 uppercase tracking-wider mb-2">⚠ Violation Detected</p>
                  <p className="text-lg">Ticket was already scanned at:</p>
                  <p className="text-xl font-bold">{new Date(result.checkInTime).toLocaleTimeString()}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col lg:flex-row">
      
      {/* LEFT COLUMN: SCANNER */}
      <div className="lg:w-1/2 p-6 flex flex-col items-center justify-center border-r border-gray-800">
        <div className="w-full max-w-md">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-black tracking-tight">SECURITY PORTAL</h2>
              <p className="text-blue-400 flex items-center gap-2 mt-1 text-sm font-semibold tracking-wide">
                <Activity size={16} /> LIVE SCANNER ACTIVE
              </p>
            </div>
            <button onClick={handleLogout} className="p-3 bg-gray-900 border border-gray-700 hover:bg-red-900/30 hover:text-red-500 hover:border-red-500 rounded-xl transition">
              <LogOut size={20} />
            </button>
          </div>

          {!scanning ? (
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-10 text-center shadow-2xl">
              <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera size={40} className="text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Initiate Scanner</h3>
              <p className="text-gray-400 text-sm mb-8">Ensure lens is clean and area is well-lit for optimal QR detection.</p>
              <button onClick={startScanning} className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                ACTIVATE CAMERA
              </button>
            </div>
          ) : (
            <div className="w-full">
              <div className="bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-800 relative">
                <div id="qr-reader" className="w-full min-h-[350px]"></div>
              </div>
              <button onClick={stopScanning} className="w-full mt-6 py-4 bg-red-600/10 text-red-500 border border-red-500/50 font-bold rounded-xl hover:bg-red-600/20 transition">
                TERMINATE SCANNER
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: LIVE STATS */}
      <div className="lg:w-1/2 p-6 bg-gray-900">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Activity size={24} className="text-blue-500" /> Live Event Telemetry</h3>
        
        {/* Graph & Main Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          
          {/* Circular Graph */}
          <div className="col-span-2 bg-gray-950 border border-gray-800 rounded-3xl p-6 flex items-center justify-between shadow-inner">
            <div>
              <p className="text-gray-400 font-semibold mb-1 uppercase tracking-wider text-sm">Attendance Progress</p>
              <p className="text-5xl font-black">{attendancePercentage}%</p>
              <p className="text-sm text-green-400 mt-2 font-medium">{stats.checkedIn} of {stats.total} Guests Arrived</p>
            </div>
            
            <div className="relative w-32 h-32">
              {/* Pure CSS SVG Donut Chart */}
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1f2937" strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${attendancePercentage}, 100`} className="transition-all duration-1000 ease-out" />
              </svg>
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <Clock className="text-yellow-500 mb-3" size={28} />
            <p className="text-3xl font-bold">{stats.pending}</p>
            <p className="text-gray-500 text-sm font-semibold mt-1">Pending Entry</p>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <ShieldAlert className="text-red-500 mb-3" size={28} />
            <p className="text-3xl font-bold text-red-500">{sessionDuplicates}</p>
            <p className="text-gray-500 text-sm font-semibold mt-1">Duplicates Blocked</p>
          </div>
        </div>

        {/* Activity Feed */}
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><History size={20} className="text-gray-400" /> Recent Scans</h3>
        <div className="space-y-3">
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 italic text-center py-8 bg-gray-950 rounded-2xl border border-gray-800 border-dashed">No recent scan activity...</p>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className={`flex items-center justify-between p-4 rounded-xl border ${activity.status === 'success' ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'}`}>
                <div>
                  <p className="font-bold text-lg">{activity.name}</p>
                  <p className="text-sm font-mono text-gray-400">{activity.roll}</p>
                </div>
                <div className="text-right">
                  {activity.status === 'success' ? (
                    <span className="text-green-400 font-bold text-sm bg-green-900/30 px-3 py-1 rounded-full inline-block mb-1">GRANTED</span>
                  ) : (
                    <span className="text-red-400 font-bold text-sm bg-red-900/30 px-3 py-1 rounded-full inline-block mb-1">DENIED</span>
                  )}
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}