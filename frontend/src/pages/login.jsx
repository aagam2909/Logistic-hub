import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, Shield, Loader2, User, KeyRound } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;
const MASTER_PASSWORD = "JFC"; // The one password for everyone

export default function Login({ onLogin }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // Fetch staff members from the database
    axios.get(`${API_BASE}/employees`)
      .then(res => {
        setEmployees(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading employees:", err);
        // Fallback fallback users if DB fails to load
        setEmployees([{ name: 'Rohit Jain' }, { name: 'Aagam Jain' }]);
        setLoading(false);
      });
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedUser) {
      setError('Please select your name from the list.');
      return;
    }

    if (password !== MASTER_PASSWORD) {
      setError('Incorrect Company Password.');
      return;
    }

    setIsAuthenticating(true);
    
    // Simulate a tiny delay for smooth UI
    setTimeout(() => {
      onLogin(selectedUser);
    }, 800);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-indigo-600 flex-col gap-3">
        <Loader2 className="h-10 w-10 animate-spin" />
        <span className="font-bold">Connecting to Central Database...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[100px] opacity-60"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[100px] opacity-60"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 relative z-10 p-8">
        
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-slate-200">
            <Truck className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Jain Freight Carriers</h1>
          <p className="text-sm font-semibold text-gray-400 mt-1">Logistics & Transportation Portal</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold p-3 rounded-xl mb-5 flex items-center gap-2">
            <Shield className="h-4 w-4" /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="h-4 w-4 text-indigo-500" /> Authorized Staff Name
            </label>
            <select 
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full border border-gray-200 bg-gray-50 text-slate-800 font-bold p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition cursor-pointer appearance-none"
            >
              <option value="" disabled>Select your name...</option>
              {employees.map((emp, idx) => (
                <option key={idx} value={emp.name}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-emerald-500" /> Master Password
            </label>
            <input 
              type="password"
              placeholder="Enter company password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 bg-gray-50 text-slate-800 font-bold p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 transition"
            />
          </div>

          <button 
            type="submit" 
            disabled={isAuthenticating}
            className={`w-full text-white font-bold p-4 rounded-xl shadow-md transition flex justify-center items-center gap-2 mt-4 ${
              isAuthenticating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg cursor-pointer'
            }`}
          >
            {isAuthenticating ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Authenticating...</>
            ) : (
              "Secure Login"
            )}
          </button>
        </form>

        <p className="text-center text-[10px] font-semibold text-gray-400 mt-8">
          Authorized Personnel Only. Actions are logged and monitored.
        </p>
      </div>
    </div>
  );
}