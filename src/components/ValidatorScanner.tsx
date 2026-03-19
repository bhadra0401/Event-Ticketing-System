import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Camera, AlertTriangle, Users, Clock, LogOut } from 'lucide-react';

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

export default function ValidatorScanner() {
  // Auth State
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // Scanner & Stats State
  const [stats, setStats] = useState<EventStats>({ total: 0, checkedIn: 0, pending: 0 });
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Authentication Check
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

  // Cleanup Scanner on Unmount
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

  const startScanning = async () => {
    try {
      setScanning(true);
      // Wait for the UI to render the div before attaching the scanner
      setTimeout(async () => {
        const html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' }, // Forces rear camera on mobile
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess,
          () => {} // Ignore scan failures (happens every frame it doesn't see a QR)
        );
      }, 100);
    } catch (err) {
      console.error('Error starting scanner:', err);
      alert('Failed to start camera. Please ensure you granted camera permissions in your browser settings.');
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
        showValidationResult({ type: 'invalid', message: 'INVALID TICKET' });
        return;
      }

      if (ticket.status === 'checked_in') {
        showValidationResult({
          type: 'duplicate',
          message: 'ALREADY CHECKED IN',
          studentName: (ticket.student as any).name,
          rollNumber: (ticket.student as any).roll_number,
          checkInTime: ticket.checked_in_at || undefined
        });
        return;
      }

      // Update to checked in
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      fetchStats(); // Update dashboard numbers

      showValidationResult({
        type: 'success',
        message: 'VALID TICKET',
        studentName: (ticket.student as any).name,
        rollNumber: (ticket.student as any).roll_number
      });
    } catch (err) {
      console.error('Error validating ticket:', err);
      showValidationResult({ type: 'invalid', message: 'INVALID QR CODE' });
    }
  };

  const showValidationResult = (validationResult: ValidationResult) => {
    setResult(validationResult);
    setShowResult(true);

    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);

    resultTimeoutRef.current = setTimeout(() => {
      setShowResult(false);
      setResult(null);
      startScanning(); // Auto-restart scanner after showing result
    }, 4000);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white">Loading...</div></div>;
  }

  // --- LOGIN SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
          <h1 className="text-2xl font-bold text-center text-white mb-6">Validator Login</h1>
          {loginError && <div className="bg-red-500 bg-opacity-20 text-red-400 p-3 rounded-lg mb-4 text-sm border border-red-500">{loginError}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition">
              Secure Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VALIDATION RESULT SCREEN ---
  if (showResult && result) {
    const bgColor = result.type === 'success' ? 'bg-green-600' : 'bg-red-600';
    const Icon = result.type === 'success' ? CheckCircle : result.type === 'duplicate' ? AlertTriangle : XCircle;

    return (
      <div className={`${bgColor} min-h-screen flex items-center justify-center p-4 animate-pulse`}>
        <div className="text-center text-white">
          <Icon size={120} className="mx-auto mb-6" strokeWidth={2} />
          <h1 className="text-5xl font-bold mb-6">{result.message}</h1>
          {result.studentName && (
            <div className="bg-white bg-opacity-20 rounded-2xl p-6 backdrop-blur-sm max-w-md mx-auto">
              <div className="space-y-3">
                <div>
                  <p className="text-sm opacity-80 mb-1">Guest Name</p>
                  <p className="text-3xl font-bold">{result.studentName}</p>
                </div>
                <div>
                  <p className="text-sm opacity-80 mb-1">Roll Number</p>
                  <p className="text-2xl font-semibold">{result.rollNumber}</p>
                </div>
                {result.checkInTime && (
                  <div className="mt-4 pt-4 border-t border-white border-opacity-30 text-yellow-200">
                    <p className="text-sm mb-1 font-bold">Originally Checked In At:</p>
                    <p className="text-lg font-medium">{new Date(result.checkInTime).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VALIDATOR DASHBOARD & SCANNER ---
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">Entry Validator</h1>
          <p className="text-gray-400 text-xs mt-1">Live Check-in Status</p>
        </div>
        <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-lg">
          <LogOut size={20} />
        </button>
      </div>

      {/* DASHBOARD STATS */}
      {!scanning && (
        <div className="grid grid-cols-3 gap-3 p-4">
          <div className="bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
            <Users className="mx-auto text-blue-400 mb-1" size={20} />
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-gray-400">Total Tickets</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center border border-green-900 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <CheckCircle className="mx-auto text-green-400 mb-1" size={20} />
            <p className="text-2xl font-bold text-green-400">{stats.checkedIn}</p>
            <p className="text-xs text-gray-400">Attended</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
            <Clock className="mx-auto text-yellow-400 mb-1" size={20} />
            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
            <p className="text-xs text-gray-400">Pending</p>
          </div>
        </div>
      )}

      {/* SCANNER AREA */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {!scanning ? (
          <div className="text-center w-full max-w-md">
            <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
              <Camera size={64} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ready to Scan</h2>
            <p className="text-gray-400 mb-8 text-sm px-4">
              Camera permissions are required. Ensure your phone is not in low-power mode if the camera fails to load.
            </p>
            <button
              onClick={startScanning}
              className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition shadow-lg"
            >
              Open Camera & Scan
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700 relative">
              {/* This is the div the scanner attaches to */}
              <div id="qr-reader" className="w-full min-h-[300px] bg-black"></div>
            </div>
            <button
              onClick={stopScanning}
              className="w-full mt-6 px-6 py-4 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition border border-gray-600"
            >
              Cancel Scanning
            </button>
          </div>
        )}
      </div>
    </div>
  );
}