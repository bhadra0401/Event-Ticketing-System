import { useNavigate } from 'react-router-dom';
import { Shield, UserCog, Ticket } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              Farewell Party Ticketing System
            </h1>
            <p className="text-blue-100 text-lg">
              Manage tickets, send invitations, and validate entries
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <button
              onClick={() => navigate('/admin')}
              className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all hover:scale-105 text-center group"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-600 transition">
                <UserCog className="text-blue-600 group-hover:text-white transition" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin</h2>
              <p className="text-gray-600">
                Manage students, send tickets, and update event details
              </p>
            </button>

            <button
              onClick={() => navigate('/validator')}
              className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all hover:scale-105 text-center group"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-600 transition">
                <Shield className="text-green-600 group-hover:text-white transition" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Validator</h2>
              <p className="text-gray-600">
                Scan QR codes and verify guest check-ins at the venue
              </p>
            </button>

            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-8 shadow-xl text-center border-2 border-white border-opacity-30">
              <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ticket className="text-white" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Student</h2>
              <p className="text-blue-100">
                Check your email for your unique ticket link
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 border border-white border-opacity-20">
              <h3 className="text-white font-semibold mb-3">How it works:</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-100">
                <div>
                  <span className="text-2xl font-bold text-white">1</span>
                  <p className="mt-1">Admin sends ticket links to students via email</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-white">2</span>
                  <p className="mt-1">Students open their unique ticket link with QR code</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-white">3</span>
                  <p className="mt-1">Validators scan QR codes at the venue entrance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
