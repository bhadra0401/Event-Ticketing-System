import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Camera, AlertTriangle } from 'lucide-react';

type ValidationResult = {
  type: 'success' | 'duplicate' | 'invalid';
  message: string;
  studentName?: string;
  rollNumber?: string;
  checkInTime?: string;
};

export default function ValidatorScanner() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopScanning();
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        () => {}
      );

      setScanning(true);
    } catch (err) {
      console.error('Error starting scanner:', err);
      alert('Failed to start camera. Please ensure camera permissions are granted.');
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
        showValidationResult({
          type: 'invalid',
          message: 'INVALID TICKET'
        });
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

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          status: 'checked_in',
          checked_in_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (updateError) {
        showValidationResult({
          type: 'invalid',
          message: 'VALIDATION ERROR'
        });
        return;
      }

      showValidationResult({
        type: 'success',
        message: 'VALID TICKET',
        studentName: (ticket.student as any).name,
        rollNumber: (ticket.student as any).roll_number
      });
    } catch (err) {
      console.error('Error validating ticket:', err);
      showValidationResult({
        type: 'invalid',
        message: 'INVALID QR CODE'
      });
    }
  };

  const showValidationResult = (validationResult: ValidationResult) => {
    setResult(validationResult);
    setShowResult(true);

    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
    }

    resultTimeoutRef.current = setTimeout(() => {
      setShowResult(false);
      setResult(null);
      startScanning();
    }, 4000);
  };

  const ResultDisplay = () => {
    if (!result) return null;

    const bgColor = result.type === 'success'
      ? 'bg-green-600'
      : 'bg-red-600';

    const Icon = result.type === 'success'
      ? CheckCircle
      : result.type === 'duplicate'
      ? AlertTriangle
      : XCircle;

    return (
      <div className={`${bgColor} min-h-screen flex items-center justify-center p-4 animate-pulse`}>
        <div className="text-center text-white">
          <Icon size={120} className="mx-auto mb-6" strokeWidth={2} />
          <h1 className="text-5xl font-bold mb-6">{result.message}</h1>

          {result.studentName && (
            <div className="bg-white bg-opacity-20 rounded-2xl p-6 backdrop-blur-sm max-w-md mx-auto">
              <div className="space-y-3">
                <div>
                  <p className="text-sm opacity-80 mb-1">Student Name</p>
                  <p className="text-3xl font-bold">{result.studentName}</p>
                </div>
                <div>
                  <p className="text-sm opacity-80 mb-1">Roll Number</p>
                  <p className="text-2xl font-semibold">{result.rollNumber}</p>
                </div>
                {result.checkInTime && (
                  <div className="mt-4 pt-4 border-t border-white border-opacity-30">
                    <p className="text-sm opacity-80 mb-1">Originally Checked In At</p>
                    <p className="text-lg font-medium">
                      {new Date(result.checkInTime).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (showResult && result) {
    return <ResultDisplay />;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold text-white text-center">Ticket Validator</h1>
        <p className="text-gray-400 text-center text-sm mt-1">Scan QR codes to check in guests</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {!scanning ? (
          <div className="text-center">
            <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Camera size={64} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Ready to Scan</h2>
            <p className="text-gray-400 mb-8 max-w-md">
              Tap the button below to activate the camera and start scanning guest tickets
            </p>
            <button
              onClick={startScanning}
              className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition shadow-lg"
            >
              Start Scanning
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              <div id="qr-reader" className="w-full"></div>
            </div>
            <button
              onClick={stopScanning}
              className="w-full mt-6 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition"
            >
              Stop Scanning
            </button>
            <div className="mt-4 text-center text-gray-400 text-sm">
              <p>Point the camera at a ticket QR code</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
