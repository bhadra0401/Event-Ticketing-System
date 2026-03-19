import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, Student, Ticket, EventSettings } from '../lib/supabase';
import QRCode from 'qrcode';
import { AlertTriangle } from 'lucide-react';

export default function TicketView() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadTicketData();
  }, [ticketId]);

  const loadTicketData = async () => {
    if (!ticketId) {
      setError('Invalid ticket URL');
      setLoading(false);
      return;
    }

    try {
      const [ticketRes, settingsRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('*, student:students(*)')
          .eq('id', ticketId)
          .maybeSingle(),
        supabase
          .from('event_settings')
          .select('*')
          .limit(1)
          .maybeSingle()
      ]);

      if (!ticketRes.data) {
        setError('Ticket not found');
        setLoading(false);
        return;
      }

      setTicket(ticketRes.data);
      setStudent(ticketRes.data.student as Student);

      if (settingsRes.data) {
        setEventSettings(settingsRes.data);
      }

      const qrData = JSON.stringify({
        ticketId: ticketRes.data.id,
        qrHash: ticketRes.data.qr_hash,
        studentId: ticketRes.data.student_id
      });

      const qrUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#fdfbf7' // Matches the vintage paper background
        }
      });

      setQrCodeUrl(qrUrl);
    } catch (err) {
      console.error('Error loading ticket:', err);
      setError('Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-900 text-xl font-bold">Loading your ticket...</div>
      </div>
    );
  }

  if (error || !ticket || !student || !eventSettings) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-xl border border-gray-200">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ticket Not Found</h1>
          <p className="text-gray-600">{error || 'This ticket does not exist or has been revoked.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-10 bg-gray-100 flex flex-col items-center justify-center min-h-screen">
      
      {/* --- BEGIN NEW VINTAGE TICKET STYLE --- */}
      {/* Fallback color #fdfbf7 used in case you don't have a background image yet */}
      <div className="relative w-full max-w-[400px] bg-[#fdfbf7] bg-cover bg-center rounded-xl shadow-2xl border-4 border-[#e9dcc5] overflow-hidden">
        
        {/* Aesthetic "VOID IF REMOVED" side text */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 rotate-180 text-gray-500 font-bold text-[9px] uppercase tracking-widest [writing-mode:vertical-rl] opacity-60">
          VOID IF REMOVED • VOID IF REMOVED
        </div>

        {/* Main Ticket Content */}
        <div className="p-8 pb-6 border-r-[12px] border-r-gray-400 border-opacity-30">
          
          {/* Top Title Section */}
          <div className="text-center mb-6">
            <h1 className="font-serif italic font-black text-5xl sm:text-6xl text-teal-700 tracking-tight leading-tight">
              FAREWELL PARTY
            </h1>
            <p className="font-condensed font-bold text-base sm:text-lg text-black uppercase tracking-wider mt-1">
              Dance • Music • Nightlife.
            </p>
          </div>

          <hr className="border-gray-900 border-t-[1.5px] opacity-20 mb-6" />

          {/* Guest and Venue Data Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <p className="font-condensed text-gray-700 font-semibold uppercase tracking-wider text-[11px] mb-1">Guest Name</p>
                <p className="font-extrabold text-xl sm:text-2xl text-black leading-tight truncate">{student.name}</p>
              </div>
              <div>
                <p className="font-condensed text-gray-700 font-semibold uppercase tracking-wider text-[11px] mb-1">Roll Number</p>
                <p className="font-extrabold text-xl sm:text-2xl text-black leading-tight">{student.roll_number}</p>
              </div>
              <div>
                <p className="font-condensed text-gray-700 font-semibold uppercase tracking-wider text-[11px] mb-1">Date</p>
                <p className="font-extrabold text-xl sm:text-2xl text-black leading-tight">{eventSettings.date}</p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <p className="font-condensed text-gray-700 font-semibold uppercase tracking-wider text-[11px] mb-1">Venue</p>
                <p className="font-extrabold text-xl sm:text-2xl text-black leading-tight truncate">{eventSettings.venue}</p>
              </div>
              <div>
                <p className="font-condensed text-gray-700 font-semibold uppercase tracking-wider text-[11px] mb-1">Time</p>
                <p className="font-extrabold text-xl sm:text-2xl text-black leading-tight">{eventSettings.time}</p>
              </div>
            </div>
          </div>

          <hr className="border-gray-900 border-t-[1.5px] opacity-20 my-6" />

          {/* Dynamic Ticket Info */}
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="font-condensed text-gray-700 font-semibold uppercase tracking-wider text-[11px] mb-1">Ticket ID</p>
              <p className="font-extrabold text-2xl text-black leading-tight font-mono">{ticket.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="font-condensed text-gray-700 font-semibold uppercase tracking-wider text-[11px] mb-1">Status</p>
              <p className="font-extrabold text-2xl text-black leading-tight">INVITE ONLY</p>
            </div>
          </div>

          {/* Barcode & Warning */}
          <div className="space-y-5">
            
            {/* Real QR Code */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-4 flex justify-center shadow-sm">
              {qrCodeUrl && (
                <img
                  src={qrCodeUrl}
                  alt="Ticket QR Code"
                  className="rounded-lg w-48 h-48 mix-blend-multiply"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {ticket.status === 'checked_in' && (
              <div className="bg-green-100 border-2 border-green-500 rounded-lg p-3 text-center">
                <p className="text-green-800 font-black uppercase tracking-widest text-lg">✓ SCANNED</p>
                <p className="text-green-700 text-xs font-bold mt-1">
                  Entered at {new Date(ticket.checked_in_at!).toLocaleTimeString()}
                </p>
              </div>
            )}

            {/* Red Warning Box */}
            <div className="bg-[#E53E3E] text-white p-5 rounded-lg border-2 border-[#b52d2d] flex items-start gap-4 shadow-inner">
              <div className="p-1.5 bg-white bg-opacity-20 rounded-md shrink-0">
                <AlertTriangle className="text-white" size={24} />
              </div>
              <div>
                <strong className="block text-sm font-extrabold uppercase tracking-wide">IMPORTANT:</strong>
                <p className="text-xs mt-1 leading-relaxed font-medium opacity-90">
                  College ID Card is MANDATORY for entry. You will not be allowed in without it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* --- END NEW VINTAGE TICKET STYLE --- */}

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500 font-medium">Please present this digital ticket at the entrance.</p>
      </div>
    </div>
  );
}