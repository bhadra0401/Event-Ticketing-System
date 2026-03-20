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
          light: '#ffffff' 
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl font-bold tracking-widest animate-pulse">GENERATING TICKET...</div>
      </div>
    );
  }

  if (error || !ticket || !student || !eventSettings) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md text-center shadow-xl border border-gray-700">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Ticket Not Found</h1>
          <p className="text-gray-400">{error || 'This ticket does not exist or has been revoked.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-10 bg-black flex flex-col items-center justify-center min-h-screen font-sans">
      
      <div 
        className="relative w-full max-w-[420px] bg-gradient-to-br from-[#8b4513] via-[#6d320b] to-[#2a160d] text-white bg-cover bg-center rounded-xl shadow-2xl border-2 border-[#b57649] overflow-hidden"
        style={{ backgroundImage: "url('/ticket-bg.png')" }} 
      >
        
        <div className="absolute right-12 top-0 bottom-0 w-px border-r-2 border-dashed border-white opacity-20"></div>

        <div className="absolute right-2 top-1/2 -translate-y-1/2 rotate-180 text-white opacity-40 font-bold text-[10px] uppercase tracking-[0.3em] [writing-mode:vertical-rl]">
          ADMIT ONE • FAREWELL 2026
        </div>

        <div className="p-8 pb-8 pr-16">
          
          <div className="text-left mb-6">
            <h1 className="font-serif italic font-black text-5xl sm:text-6xl text-[#fdfbf7] tracking-tight leading-none drop-shadow-lg uppercase">
              FAREWELL<br/>PARTY
            </h1>
            <p className="font-condensed font-bold text-sm sm:text-base text-white/90 uppercase tracking-[0.25em] mt-3">
              Dance • Music • Nightlife.
            </p>
          </div>

          <hr className="border-white border-t-[1px] opacity-20 mb-6" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-6 text-sm">
            <div className="space-y-5">
              <div>
                <p className="font-condensed text-white/60 font-bold uppercase tracking-widest text-[10px] mb-1">Guest Name</p>
                <p className="font-extrabold text-lg text-[#fdfbf7] leading-snug break-words uppercase">{student.name}</p>
              </div>
              <div>
                <p className="font-condensed text-white/60 font-bold uppercase tracking-widest text-[10px] mb-1">Roll Number</p>
                <p className="font-extrabold text-lg text-[#fdfbf7] leading-snug break-words">{student.roll_number}</p>
              </div>
              <div>
                <p className="font-condensed text-white/60 font-bold uppercase tracking-widest text-[10px] mb-1">Date</p>
                <p className="font-extrabold text-lg text-[#fdfbf7] leading-snug">{eventSettings.date}</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="font-condensed text-white/60 font-bold uppercase tracking-widest text-[10px] mb-1">Venue</p>
                <p className="font-extrabold text-lg text-[#fdfbf7] leading-snug break-words uppercase">{eventSettings.venue}</p>
              </div>
              <div>
                <p className="font-condensed text-white/60 font-bold uppercase tracking-widest text-[10px] mb-1">Time</p>
                <p className="font-extrabold text-lg text-[#fdfbf7] leading-snug break-words uppercase">{eventSettings.time}</p>
              </div>
            </div>
          </div>

          <hr className="border-white border-t-[1px] opacity-20 my-6" />

          <div className="flex justify-between items-end mb-6 relative">
            <div>
              <p className="font-condensed text-white/60 font-bold uppercase tracking-widest text-[10px] mb-1">Ticket ID</p>
              <p className="font-extrabold text-xl text-[#fdfbf7] leading-tight font-mono">{ticket.id.slice(0, 8).toUpperCase()}</p>
            </div>

            <div className="text-right relative">
              <div className="absolute -top-16 right-0 w-36 h-24 pointer-events-none z-20">
                <img 
                  src="/signature.png" 
                  alt="Authorized Signature" 
                  className="w-full h-full object-contain invert-[1] brightness-[10] contrast-[100%] rotate-[-4deg]"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
              <div className="border-t border-white/40 pt-1">
                <p className="font-condensed text-white/70 font-bold uppercase tracking-widest text-[10px]">Authorized By</p>
                <p className="font-serif italic text-sm text-[#fdfbf7]">Organizing Committee</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 mt-8">
            <div className="bg-white p-3 rounded-xl flex justify-center shadow-2xl mx-auto w-fit">
              {qrCodeUrl && (
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="rounded-lg w-40 h-40"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {ticket.status === 'checked_in' && (
              <div className="bg-green-500 bg-opacity-20 border border-green-500 rounded-lg p-3 text-center">
                <p className="text-green-400 font-black uppercase tracking-widest text-lg">✓ SCANNED</p>
                <p className="text-green-300/80 text-xs font-bold mt-1">
                  Entered at {new Date(ticket.checked_in_at!).toLocaleTimeString()}
                </p>
              </div>
            )}

            <div className="bg-black/40 text-white p-4 rounded-lg border border-red-500/50 flex items-start gap-4">
              <div className="p-1.5 bg-red-500/20 rounded-md shrink-0">
                <AlertTriangle className="text-red-400" size={20} />
              </div>
              <div>
                <strong className="block text-xs font-extrabold text-red-400 uppercase tracking-wide">MANDATORY:</strong>
                <p className="text-[11px] mt-1 leading-relaxed font-medium opacity-90 text-white/80">
                  College ID Card is required for entry.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center opacity-50">
        <p className="text-xs text-white font-medium uppercase tracking-widest">Please present this digital ticket at the entrance.</p>
      </div>
    </div>
  );
}
