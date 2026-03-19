import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, Student, Ticket, EventSettings } from '../lib/supabase';
import QRCode from 'qrcode';
import { Music, Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';

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
          light: '#FFFFFF'
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading your ticket...</div>
      </div>
    );
  }

  if (error || !ticket || !student || !eventSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ticket Not Found</h1>
          <p className="text-gray-600">{error || 'This ticket does not exist or has been revoked.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Music size={24} />
              <h1 className="text-3xl font-bold tracking-tight">FAREWELL PARTY</h1>
            </div>
            <p className="text-blue-100 text-sm tracking-wide">Dance • Music • Nightlife</p>
          </div>

          <div className="p-6">
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
              <div>
                <p className="font-bold text-red-900 text-sm uppercase tracking-wide mb-1">Important</p>
                <p className="text-red-800 text-sm font-medium">College ID Card is MANDATORY for entry</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="border-b border-gray-200 pb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Guest Name</p>
                <p className="text-xl font-bold text-gray-900">{student.name}</p>
              </div>

              <div className="border-b border-gray-200 pb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Roll Number</p>
                <p className="text-lg font-semibold text-gray-900">{student.roll_number}</p>
              </div>

              <div className="border-b border-gray-200 pb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ticket ID</p>
                <p className="text-sm font-mono text-gray-700">{ticket.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-4 space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Calendar className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Date</p>
                  <p className="font-semibold text-gray-900">{eventSettings.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Clock className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Time</p>
                  <p className="font-semibold text-gray-900">{eventSettings.time}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <MapPin className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Venue</p>
                  <p className="font-semibold text-gray-900">{eventSettings.venue}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Scan at Entry</p>
              {qrCodeUrl && (
                <img
                  src={qrCodeUrl}
                  alt="Ticket QR Code"
                  className="mx-auto rounded-lg"
                  style={{ width: '250px', height: '250px' }}
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {ticket.status === 'checked_in' && (
              <div className="mt-6 bg-green-50 border border-green-500 rounded-xl p-4 text-center">
                <p className="text-green-800 font-semibold">✓ Checked In</p>
                <p className="text-green-600 text-sm mt-1">
                  {new Date(ticket.checked_in_at!).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div className="bg-gray-100 px-6 py-4 text-center">
            <p className="text-xs text-gray-500">This is your digital ticket. Keep it handy!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
