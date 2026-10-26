import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, Wallet, ArrowDownRight, ArrowUpRight, Search, 
  Calendar, CheckCircle2, FileSpreadsheet, Plus, ShieldCheck, 
  UserCheck, Loader2, Crown, User, X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const s = String(dateStr).slice(0, 10);
  const parts = s.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : s;
}

export default function StaffLedger() {
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [loading, setLoading] = useState(true);

  // Add Staff Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', role: 'Employee', phone: '' });
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, [selectedEmp, selectedMonth]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [empRes, sumRes, entRes] = await Promise.all([
        axios.get(`${API_BASE}/employees`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/employees/ledger-summary?month=${selectedMonth}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/employees/ledger-entries?employee=${selectedEmp}&month=${selectedMonth}`).catch(() => ({ data: [] }))
      ]);

      const empList = Array.isArray(empRes.data) ? empRes.data : [];
      setEmployees(empList);

      // Merge employee list with summary metrics so all 5 always display
      const summaryData = Array.isArray(sumRes.data) ? sumRes.data : [];
      const mergedSummary = empList.map(emp => {
        const found = summaryData.find(s => s.employee_name.toLowerCase() === emp.name.toLowerCase());
        return {
          employee_name: emp.name,
          role: emp.role,
          phone: emp.phone,
          total_loaded: found ? parseFloat(found.total_loaded || 0) : 0,
          total_disbursed: found ? parseFloat(found.total_disbursed || 0) : 0,
          remaining_float: found ? parseFloat(found.remaining_float || 0) : 0
        };
      });

      setSummary(mergedSummary);
      setEntries(Array.isArray(entRes.data) ? entRes.data : []);
    } catch (err) {
      console.error("Error fetching staff ledger data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name.trim()) return alert("Staff name is required.");
    setSavingStaff(true);
    try {
      await axios.post(`${API_BASE}/employees`, newStaff);
      alert(`Staff member ${newStaff.name} added successfully!`);
      setShowAddModal(false);
      setNewStaff({ name: '', role: 'Employee', phone: '' });
      fetchInitialData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to add employee.");
    } finally {
      setSavingStaff(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-600" /> Staff & Card Float Accounts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tracking I-Fleet loads by Rohit Jain vs. Omni card field disbursements by Subhash, Vinod, Vishnu, and Deepak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 px-3 py-1.5 rounded-xl">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
              className="text-xs font-bold outline-none bg-transparent cursor-pointer text-slate-800"
            />
          </div>

          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Team Member
          </button>
        </div>
      </div>

      {/* Staff Account Summary Cards (1 Master + 4 Employees) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {summary.map((emp) => {
          const isMaster = emp.role === 'Master' || emp.employee_name === 'Rohit Jain';
          const isSelected = selectedEmp === emp.employee_name;

          return (
            <div 
              key={emp.employee_name} 
              onClick={() => setSelectedEmp(isSelected ? 'All' : emp.employee_name)}
              className={`bg-white p-5 rounded-2xl border-2 transition cursor-pointer shadow-sm relative overflow-hidden ${
                isSelected 
                  ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-md' 
                  : isMaster 
                  ? 'border-amber-200 hover:border-amber-400 bg-amber-50/20' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  {isMaster ? <Crown className="h-4 w-4 text-amber-500 fill-amber-500" /> : <UserCheck className="h-4 w-4 text-indigo-600" />}
                  {emp.employee_name}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isMaster 
                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {isMaster ? 'Master Control' : 'Staff'}
                </span>
              </div>

              {emp.phone && <p className="text-[10px] text-gray-400 mb-2">{emp.phone}</p>}

              <div className="space-y-1.5 text-xs mt-3">
                <div className="flex justify-between text-gray-500">
                  <span>Loaded (I-Fleet):</span>
                  <span className="font-bold text-slate-800">
                    ₹{parseFloat(emp.total_loaded || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Disbursed (Omni):</span>
                  <span className="font-bold text-rose-600">
                    ₹{parseFloat(emp.total_disbursed || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t font-black">
                  <span className="text-slate-900">Float Balance:</span>
                  <span className={(emp.remaining_float || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    ₹{parseFloat(emp.remaining_float || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transactions & Disbursement Ledger */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-sm">
              Disbursement & Expense Ledger
            </h3>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {selectedEmp === 'All' ? 'All Team Members' : selectedEmp}
            </span>
          </div>
          <span className="text-xs text-gray-500 font-semibold">{entries.length} recorded entries</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 flex justify-center items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Loading account logs...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-gray-200 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Team Member</th>
                  <th className="p-3">Truck Number</th>
                  <th className="p-3">Expense Category</th>
                  <th className="p-3">Recipient / Note</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3 text-center">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-medium text-gray-600">{formatDate(item.transaction_date)}</td>
                    <td className="p-3 font-bold text-slate-800">{item.employee_name}</td>
                    <td className="p-3 font-black text-indigo-700">{item.vehicle_number || '-'}</td>
                    <td className="p-3">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        {item.expense_category}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 max-w-xs truncate" title={item.raw_notes}>
                      {item.raw_notes || item.recipient_name || '-'}
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">
                      ₹{parseFloat(item.amount || 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.source_file === 'OMNI' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.source_file}
                      </span>
                    </td>
                  </tr>
                ))}

                {entries.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400 italic">
                      No expense transactions recorded for {selectedEmp} in {selectedMonth}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Team Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" /> Register Team Member
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Full Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Deepak" 
                  value={newStaff.name} 
                  onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} 
                  className="w-full border border-gray-300 rounded-lg p-2.5 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100" 
                  required 
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Role Permission</label>
                <select 
                  value={newStaff.role} 
                  onChange={e => setNewStaff({ ...newStaff, role: e.target.value })} 
                  className="w-full border border-gray-300 rounded-lg p-2.5 font-semibold text-slate-800 outline-none bg-white"
                >
                  <option value="Employee">Employee (Entry & Road Disbursements)</option>
                  <option value="Master">Master (Full Financial Control)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Phone Number (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 9876543210" 
                  value={newStaff.phone} 
                  onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })} 
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100" 
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingStaff} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-bold rounded-xl shadow-sm transition"
                >
                  {savingStaff ? "Saving..." : "Save Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}