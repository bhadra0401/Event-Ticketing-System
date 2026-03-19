import { useState, useEffect } from 'react';
import { supabase, StudentWithTicket, EventSettings } from '../lib/supabase';
import { Mail, Settings as SettingsIcon, UserPlus, RefreshCw, Database } from 'lucide-react';
import EventSettingsModal from './EventSettingsModal';
import AddStudentModal from './AddStudentModal';
import { insertSampleData } from '../utils/sampleData';

export default function AdminDashboard() {
  const [students, setStudents] = useState<StudentWithTicket[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingTicket, setSendingTicket] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, settingsRes] = await Promise.all([
        supabase
          .from('students')
          .select('*, ticket:tickets(*)')
          .order('roll_number'),
        supabase
          .from('event_settings')
          .select('*')
          .limit(1)
          .maybeSingle()
      ]);

      if (studentsRes.data) {
        const formattedStudents = studentsRes.data.map(student => ({
          ...student,
          ticket: Array.isArray(student.ticket)
            ? student.ticket[0] || null
            : student.ticket
        }));
        setStudents(formattedStudents);
      }

      if (settingsRes.data) {
        setEventSettings(settingsRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTicket = async (studentId: string) => {
    try {
      const qrHash = crypto.randomUUID();
      const { error } = await supabase
        .from('tickets')
        .insert({
          student_id: studentId,
          qr_hash: qrHash,
          status: 'pending'
        });

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error generating ticket:', error);
      alert('Failed to generate ticket');
    }
  };

  const sendTicket = async (student: StudentWithTicket) => {
    if (!student.ticket) {
      await generateTicket(student.id);
      const updated = await supabase
        .from('students')
        .select('*, ticket:tickets(*)')
        .eq('id', student.id)
        .single();

      if (updated.data?.ticket) {
        student = {
          ...updated.data,
          ticket: Array.isArray(updated.data.ticket)
            ? updated.data.ticket[0]
            : updated.data.ticket
        };
      }
    }

    setSendingTicket(student.id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-ticket`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            email: student.email,
            name: student.name,
            ticketId: student.ticket?.id
          })
        }
      );

      if (!response.ok) throw new Error('Failed to send email');

      await supabase
        .from('tickets')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', student.ticket?.id);

      await loadData();
      alert('Ticket sent successfully!');
    } catch (error) {
      console.error('Error sending ticket:', error);
      alert('Failed to send ticket email');
    } finally {
      setSendingTicket(null);
    }
  };

  const loadSampleData = async () => {
    if (!confirm('This will add 5 sample students to the database. Continue?')) {
      return;
    }

    try {
      await insertSampleData(supabase);
      await loadData();
      alert('Sample data loaded successfully!');
    } catch (error) {
      console.error('Error loading sample data:', error);
      alert('Failed to load sample data. Students may already exist.');
    }
  };

  const getStatusBadge = (student: StudentWithTicket) => {
    if (!student.ticket) {
      return <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700">No Ticket</span>;
    }

    switch (student.ticket.status) {
      case 'checked_in':
        return <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">Checked In</span>;
      case 'sent':
        return <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">Sent</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700">Pending</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700">Unknown</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Manage students and event details</p>
            </div>
            <div className="flex gap-3">
              {students.length === 0 && (
                <button
                  onClick={loadSampleData}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <Database size={18} />
                  Load Sample Data
                </button>
              )}
              <button
                onClick={() => setShowAddStudent(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <UserPlus size={18} />
                Add Student
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <SettingsIcon size={18} />
                Event Settings
              </button>
              <button
                onClick={loadData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                <RefreshCw size={18} />
                Refresh
              </button>
            </div>
          </div>

          {eventSettings && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">{eventSettings.event_name}</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Date:</span>
                  <span className="ml-2 text-blue-900">{eventSettings.date}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Time:</span>
                  <span className="ml-2 text-blue-900">{eventSettings.time}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Venue:</span>
                  <span className="ml-2 text-blue-900">{eventSettings.venue}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Roll Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.roll_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.email}</td>
                    <td className="px-6 py-4 text-sm">{getStatusBadge(student)}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => sendTicket(student)}
                        disabled={sendingTicket === student.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed"
                      >
                        <Mail size={16} />
                        {sendingTicket === student.id ? 'Sending...' : 'Send Ticket'}
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
        <EventSettingsModal
          settings={eventSettings}
          onClose={() => setShowSettings(false)}
          onUpdate={loadData}
        />
      )}

      {showAddStudent && (
        <AddStudentModal
          onClose={() => setShowAddStudent(false)}
          onAdd={loadData}
        />
      )}
    </div>
  );
}
