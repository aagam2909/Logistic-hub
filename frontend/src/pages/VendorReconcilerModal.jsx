import React, { useState } from 'react';
import axios from 'axios';
import { 
  UploadCloud, CheckCircle2, FileSpreadsheet, Loader2, X, 
  Trash2, AlertTriangle, FileCheck, Layers
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

// Auto-detect vendor report type from filename
const detectVendorType = (filename) => {
  const name = filename.toLowerCase();
  if (name.includes('toll') || name.includes('onlinestatement') || name.includes('fastag')) {
    return 'FASTAG';
  }
  if (name.includes('sales transaction') || name.includes('sale trans') || name.includes('bpcl')) {
    return 'BPCL_DIESEL';
  }
  if (name.includes('customertransaction') || name.includes('hpcl')) {
    return 'HPCL_DIESEL';
  }
  if (name.includes('omni') || name.includes('fleet') || name.includes('card')) {
    return 'FLEET_EXPENSE';
  }
  return 'AUTO_DETECT';
};

const VENDOR_OPTIONS = [
  { value: 'AUTO_DETECT', label: '⚡ Auto-Detect (Recommended)' },
  { value: 'FASTAG', label: '🚗 FASTag / Toll Statement' },
  { value: 'BPCL_DIESEL', label: '⛽ BPCL Diesel Transaction' },
  { value: 'HPCL_DIESEL', label: '⛽ HPCL DriveTrack Plus' },
  { value: 'FLEET_EXPENSE', label: '💳 Omni Card / I-Fleet Advance' },
];

export default function VendorReconcilerModal({ isOpen, onClose, onSyncComplete }) {
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFilesAdded = (files) => {
    const newItems = Array.from(files).map((f) => ({
      file: f,
      id: Math.random().toString(36).substring(7),
      type: detectVendorType(f.name),
    }));
    setFileList((prev) => [...prev, ...newItems]);
    setResult(null);
  };

  const handleRemoveFile = (id) => {
    setFileList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleTypeChange = (id, newType) => {
    setFileList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, type: newType } : item))
    );
  };

  const handleUploadAndSync = async () => {
    if (fileList.length === 0) {
      return alert("Please select or drop at least one vendor spreadsheet.");
    }

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    fileList.forEach((item) => {
      formData.append("files", item.file);
    });

    try {
      const res = await axios.post(
        `${API_BASE}/reconcile/upload-vendor-statements`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      setResult(res.data.summary);
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      console.error("Reconciliation error:", err);
      alert(err.response?.data?.detail || "Reconciliation failed. Check terminal logs.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b pb-4 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
              Vendor Statement Auto-Reconciler
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Drop BPCL, HPCL, FASTag, or Omni/I-Fleet statements. The system identifies truck numbers and dates automatically.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
            dragOver ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-300 bg-gray-50 hover:border-emerald-400'
          }`}
        >
          <UploadCloud className="h-10 w-10 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">
            Drag & drop vendor Excel or CSV files here
          </p>
          <p className="text-xs text-gray-400 mt-1 mb-3">
            Supports: .csv, .xls, .xlsx (BPCL, HPCL, Toll Summary, Omni Card, I-Fleet)
          </p>
          <label className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow-sm inline-block">
            Browse Files
            <input
              type="file"
              multiple
              accept=".csv,.xls,.xlsx"
              onChange={(e) => handleFilesAdded(e.target.files)}
              className="hidden"
            />
          </label>
        </div>

        {/* File Queue with Auto-Detected Tags & Overrides */}
        <div className="flex-1 overflow-y-auto my-4 space-y-2 pr-1 max-h-56">
          {fileList.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-sm gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {(item.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <select
                  value={item.type}
                  onChange={(e) => handleTypeChange(item.id, e.target.value)}
                  className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {VENDOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleRemoveFile(item.id)}
                  className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Remove file"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {fileList.length === 0 && !result && (
            <p className="text-center text-xs text-gray-400 py-3">No files added to sync queue yet.</p>
          )}
        </div>

        {/* Results Banner */}
        {result && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              Reconciliation Complete ({result.files_processed} files processed)
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 font-medium">
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                🚗 FASTag Tolls Added: <strong>{result.fastag_entries_added}</strong>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                ⛽ Diesel Logs Added: <strong>{result.diesel_entries_added}</strong>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                💳 Fleet Expenses Matched: <strong>{result.expenses_matched}</strong>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                ⚠️ Unmatched Entries: <strong>{result.unmatched_records}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center border-t pt-4">
          <span className="text-xs text-gray-500 font-medium">
            {fileList.length} file(s) in queue
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => { setFileList([]); setResult(null); onClose(); }}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Close
            </button>
            <button
              onClick={handleUploadAndSync}
              disabled={uploading || fileList.length === 0}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm flex items-center gap-2 transition ${
                uploading || fileList.length === 0
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Matching & Syncing...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Process & Auto-Sync
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}