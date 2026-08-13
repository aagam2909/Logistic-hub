import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Clock } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

export default function ActivityLog() {
   const [logs, setLogs] = useState([]);

   useEffect(() => {
       const fetchLogs = async () => {
           try {
               const res = await axios.get(`${API_BASE}/logs`);
               setLogs(res.data);
           } catch(e) {
               console.error("Failed to fetch logs");
           }
       };
       fetchLogs();
       // Auto-refresh logs every 30 seconds
       const interval = setInterval(fetchLogs, 30000);
       return () => clearInterval(interval);
   }, []);

   return (
       <div className="bg-slate-900 border-t-4 border-slate-700 p-5 rounded-2xl mt-8 shadow-sm">
          <h4 className="text-white font-bold mb-4 flex items-center gap-2">
             <Clock className="h-5 w-5 text-emerald-400"/> System Activity & Edit Logs
          </h4>
          <div className="h-48 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
              {logs.map((log) => (
                  <div key={log.id} className="border-b border-slate-800 py-2 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs font-mono">
                      <span className="text-emerald-400 whitespace-nowrap w-40 shrink-0">
                          {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                      <span className="text-blue-400 font-bold w-32 shrink-0">{log.action}</span>
                      <span className="text-slate-300 flex-1">{log.details}</span>
                  </div>
              ))}
              {logs.length === 0 && <div className="text-slate-500 italic py-4">No recent activity found.</div>}
          </div>
       </div>
   );
}