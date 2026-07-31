import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Truck, Users, MapPin, Receipt, ArrowRight, Loader2, AlertCircle, X, Download, FileSpreadsheet, FileText, CheckCircle2, BriefcaseBusiness, Settings2, Table } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const [stats, setStats] = useState({
    activeTrucks: 0, 
    availableTrucks: 0, 
    totalDrivers: 0, 
    activeTrips: 0, 
    pendingPods: 0,
  });

  const [recentTrips, setRecentTrips] = useState([]);
  const [expiringDrivers, setExpiringDrivers] = useState([]);

  // --- REPORTING ENGINE STATE ---
  const [exportType, setExportType] = useState('master'); 
  const [customStatus, setCustomStatus] = useState('All');
  const [exportCols, setExportCols] = useState({
    tracking_number: true, 
    trip_start_date: true, 
    vehicle_number: true, 
    route: true, 
    party_name: true, 
    freight_amount: true, 
    balance_payment: true, 
    diesel_needed: true, 
    diesel_left: true, 
    fastag_est: true, 
    fastag_act: true
  });

  const colLabels = {
    tracking_number: "Tracking No", 
    trip_start_date: "Launch Date", 
    vehicle_number: "Vehicle",
    route: "Route (Src -> Dest)", 
    party_name: "Party Name", 
    freight_amount: "Total Freight",
    balance_payment: "Pending Balance", 
    diesel_needed: "Diesel Needed (Liters)", 
    diesel_left: "Diesel Left (Taabi)", 
    fastag_est: "Fastag Est (Rs)", 
    fastag_act: "Fastag Actual (Rs)"
  };

  useEffect(() => { 
    fetchDashboardData(); 
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [assetsRes, driversRes, activeTripsRes, expiringRes] = await Promise.all([
        axios.get(`${API_BASE}/assets`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/drivers`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/trips/active`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/drivers/expiring-licenses`).catch(() => ({ data: [] }))
      ]);

      const assets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
      const drivers = Array.isArray(driversRes.data) ? driversRes.data : [];
      const activeTrips = Array.isArray(activeTripsRes.data) ? activeTripsRes.data : [];
      
      const available = assets.filter(a => a.current_status === 'Available').length;
      const inTransit = assets.filter(a => a.current_status === 'In-Transit').length;
      const pendingPods = activeTrips.filter(t => t.pod_status === 'Pending' || !t.pod_status).length;

      setStats({ 
        activeTrucks: inTransit, 
        availableTrucks: available, 
        totalDrivers: drivers.length, 
        activeTrips: activeTrips.length, 
        pendingPods: pendingPods 
      });

      setRecentTrips([...activeTrips].reverse().slice(0, 5));
      if (Array.isArray(expiringRes.data)) {
          setExpiringDrivers(expiringRes.data);
      }
    } catch (error) { 
        console.error("Error fetching dashboard data:", error); 
    } finally { 
        setLoading(false); 
    }
  };

  // --- EXCEL GENERATOR ---
  const generateReport = async () => {
    setLoading(true);
    try {
      const [activeRes, historyRes, assetsRes] = await Promise.all([
        axios.get(`${API_BASE}/trips/active`),
        axios.get(`${API_BASE}/trips/history`),
        axios.get(`${API_BASE}/assets`)
      ]);
      
      const active = activeRes.data || [];
      const history = historyRes.data || [];
      const assets = assetsRes.data || [];
      
      const allTrips = [...active, ...history].map(trip => {
          const asset = assets.find(a => a.vehicle_number === trip.vehicle_number);
          // Attach truck mileage directly to the trip for fallback math
          return { 
              ...trip, 
              driver_name: asset?.driver_name || 'Unknown',
              mileage: asset?.mileage || 5.5 
          };
      });

      // ALWAYS FETCH LIVE TAABI DIESEL DATA FOR EXCEL
      let taabiData = {};
      try { 
          taabiData = (await axios.get(`${API_BASE}/taabi/bulk`)).data || {}; 
      } catch(e) {
          console.error("Failed to fetch Taabi data");
      }

      // 🌟 SMART FALLBACK CALCULATIONS FOR EXCEL
      const getTelemetry = (trip) => {
          const cleanVN = (trip.vehicle_number || '').replace(/[- ]/g, '').toUpperCase();
          const dLeft = trip.actual_delivery_date ? 'Trip Complete' : (taabiData[cleanVN] || 'N/A');
          let fastagAct = 0;
          try {
              const fDetails = typeof trip.fastag_details === 'string' ? JSON.parse(trip.fastag_details) : (trip.fastag_details || []);
              fastagAct = fDetails.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
          } catch(e) {}
          
          const km = parseFloat(trip.total_km) || 0;
          const mileage = parseFloat(trip.mileage) || 5.5;

          // Auto-calculate if database says 0
          const dieselNeeded = parseFloat(trip.diesel_liters_needed) || (km > 0 ? (km / mileage).toFixed(2) : 0);
          const fastagEst = parseFloat(trip.fastag_estimate) || (km > 0 ? (km * 5.75).toFixed(2) : 0);

          return {
              dieselNeeded: dieselNeeded,
              dieselLeft: dLeft,
              fastagEst: fastagEst,
              fastagAct: fastagAct
          };
      };

      let csvData = [];
      let filename = "Report.csv";
      const todayStr = new Date().toISOString().split('T')[0];

      if (exportType === 'master') {
         filename = `Detailed_Trip_Report_${todayStr}.csv`;
         let filtered = allTrips;
         if (customStatus === 'Active') filtered = active;
         if (customStatus === 'Completed') filtered = history;

         csvData = filtered.map(trip => {
            let advDate = '';
            try {
                const advList = typeof trip.advance_details === 'string' ? JSON.parse(trip.advance_details) : (trip.advance_details || []);
                if (advList.length > 0) advDate = advList[0].date || '';
            } catch(e) {}
            
            const freight = parseFloat(trip.freight_amount) || 0;
            const loading = parseFloat(trip.loading_charge) || 0;
            const holding = parseFloat(trip.holding_charge) || 0;
            const gst = parseFloat(trip.gst) || 0;
            const totalFreight = freight + loading + holding + gst;

            const tele = getTelemetry(trip);

            return {
                'DATE': trip.trip_start_date || '-',
                'FROM': trip.source_city || '-',
                'TO': trip.destination_city || '-',
                'VEHICLE NO': trip.vehicle_number || '-',
                'PARTY': trip.party_name || '-',
                'OWNER NAME': trip.owner_name || '-',
                'FREIGHT': freight,
                'UNLOADING': loading,
                'HOLDING': holding,
                'GST': gst,
                'TOTAL FREIGHT': totalFreight.toFixed(2),
                'ADVANCE': trip.adv_amt || 0,
                'ADVANCE DATE': advDate,
                'TDS': trip.tds || 0,
                'EXTRA DEDUCTION': trip.extra_deduction || 0,
                'BALANCE': trip.balance_payment || 0,
                'DIESEL NEEDED (L)': tele.dieselNeeded,
                'DIESEL LEFT (Taabi)': tele.dieselLeft,
                'FASTAG EST (Rs)': tele.fastagEst,
                'FASTAG ACTUAL (Rs)': tele.fastagAct,
                'POD RECEIVED DATE': trip.pod_received_client_date || '-',
                'GTA': trip.gta_name || '-',
                'L R NO.': trip.lr_no || '-',
                'EWAY BILL': trip.eway_bill || '-'
            };
         });
      }
      else if (exportType === 'today') {
         filename = `Todays_Dispatches_${todayStr}.csv`;
         csvData = allTrips.filter(t => t.trip_start_date === todayStr).map(trip => {
            const tele = getTelemetry(trip);
            return {
                'Tracking No': trip.tracking_number || '-', 
                'Launch Date': trip.trip_start_date || '-', 
                'Vehicle': trip.vehicle_number || '-', 
                'Route': `${trip.source_city} to ${trip.destination_city}`,
                'Party Name': trip.party_name || '-', 
                'Freight (Rs)': trip.freight_amount || 0, 
                'Pending Balance (Rs)': trip.balance_payment || 0, 
                'Diesel Needed (L)': tele.dieselNeeded,
                'Diesel Left (Taabi)': tele.dieselLeft,
                'Fastag Est (Rs)': tele.fastagEst,
                'Fastag Actual (Rs)': tele.fastagAct,
                'POD Status': trip.pod_status || 'Pending'
            };
         });
      }
      else if (exportType === 'active') {
         filename = `Active_Fleet_Report_${todayStr}.csv`;
         csvData = active.map(trip => {
            const tele = getTelemetry(trip);
            return {
                'Tracking No': trip.tracking_number || '-', 
                'Launch Date': trip.trip_start_date || '-', 
                'Vehicle': trip.vehicle_number || '-', 
                'Route': `${trip.source_city} to ${trip.destination_city}`,
                'Party Name': trip.party_name || '-', 
                'Freight (Rs)': trip.freight_amount || 0, 
                'Pending Balance (Rs)': trip.balance_payment || 0, 
                'Diesel Needed (L)': tele.dieselNeeded,
                'Diesel Left (Taabi)': tele.dieselLeft,
                'Fastag Est (Rs)': tele.fastagEst,
                'Fastag Actual (Rs)': tele.fastagAct,
                'POD Status': trip.pod_status || 'Pending'
            };
         });
      }
      else if (exportType === 'completed') {
         filename = `Completed_Trips_History_${todayStr}.csv`;
         csvData = history.map(trip => {
            const tele = getTelemetry(trip);
            return {
                'Tracking No': trip.tracking_number || '-', 
                'Launch Date': trip.trip_start_date || '-', 
                'Delivery Date': trip.actual_delivery_date || '-',
                'Vehicle': trip.vehicle_number || '-', 
                'Route': `${trip.source_city} to ${trip.destination_city}`,
                'Party Name': trip.party_name || '-', 
                'Freight (Rs)': trip.freight_amount || 0, 
                'Pending Balance (Rs)': trip.balance_payment || 0, 
                'Diesel Needed (L)': tele.dieselNeeded,
                'Diesel Left (Taabi)': tele.dieselLeft,
                'Fastag Est (Rs)': tele.fastagEst,
                'Fastag Actual (Rs)': tele.fastagAct,
                'POD Status': trip.pod_status || 'Pending'
            };
         });
      }
      else if (exportType === 'party') {
         filename = `Client_Ledger_Summary_${todayStr}.csv`;
         const partyMap = {};
         allTrips.forEach(trip => {
             const pName = trip.party_name || 'UNKNOWN PARTY';
             if (!partyMap[pName]) partyMap[pName] = { total: 0, active: 0, completed: 0, pendingRs: 0, totalFreight: 0, dieselNeeded: 0, fastagEst: 0, fastagAct: 0 };
             partyMap[pName].total += 1;
             partyMap[pName].totalFreight += parseFloat(trip.freight_amount || 0);
             partyMap[pName].pendingRs += parseFloat(trip.balance_payment || 0);
             if (trip.actual_delivery_date) partyMap[pName].completed += 1;
             else partyMap[pName].active += 1;

             const tele = getTelemetry(trip);
             partyMap[pName].dieselNeeded += parseFloat(tele.dieselNeeded || 0);
             partyMap[pName].fastagEst += parseFloat(tele.fastagEst || 0);
             partyMap[pName].fastagAct += parseFloat(tele.fastagAct || 0);
         });
         
         csvData = Object.keys(partyMap).map(key => ({
             'Client / Party Name': key,
             'Total Trips Managed': partyMap[key].total,
             'Currently Active Routes': partyMap[key].active,
             'Completed Routes': partyMap[key].completed,
             'Total Business (Rs)': partyMap[key].totalFreight.toFixed(2),
             'Total Outstanding Due (Rs)': partyMap[key].pendingRs.toFixed(2),
             'Total Diesel Needed (L)': partyMap[key].dieselNeeded.toFixed(2),
             'Total Fastag Est (Rs)': partyMap[key].fastagEst.toFixed(2),
             'Total Fastag Actual (Rs)': partyMap[key].fastagAct.toFixed(2),
             'Status': partyMap[key].pendingRs <= 0 ? 'All Clear (0 Balance)' : 'Payment Pending'
         }));
      }
      else if (exportType === 'custom') {
         filename = `Custom_Report_${todayStr}.csv`;
         let filtered = allTrips;
         if (customStatus === 'Active') filtered = active;
         if (customStatus === 'Completed') filtered = history;
         
         csvData = filtered.map(trip => {
            const row = {};
            const tele = getTelemetry(trip);

            if (exportCols.tracking_number) row['Tracking No'] = trip.tracking_number || '-';
            if (exportCols.trip_start_date) row['Launch Date'] = trip.trip_start_date || '-';
            if (exportCols.vehicle_number) row['Vehicle'] = trip.vehicle_number || '-';
            if (exportCols.route) row['Route'] = `${trip.source_city} to ${trip.destination_city}`;
            if (exportCols.party_name) row['Party Name'] = trip.party_name || '-';
            if (exportCols.freight_amount) row['Freight (Rs)'] = trip.freight_amount || 0;
            if (exportCols.balance_payment) row['Pending Due (Rs)'] = trip.balance_payment || 0;
            if (exportCols.pod_status) row['POD Status'] = trip.pod_status || 'Pending';
            if (exportCols.diesel_needed) row['Diesel Needed (Liters)'] = tele.dieselNeeded;
            if (exportCols.diesel_left) row['Diesel Left (Taabi)'] = tele.dieselLeft;
            if (exportCols.fastag_est) row['Fastag Est (Rs)'] = tele.fastagEst;
            if (exportCols.fastag_act) row['Fastag Actual (Rs)'] = tele.fastagAct;
            
            return row;
         });
      }

      if (csvData.length === 0) {
         alert("No data available for this report type!");
         setLoading(false);
         return;
      }

      const headers = Object.keys(csvData[0]).join(',');
      const rows = csvData.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
      const csvContent = `${headers}\n${rows}`;
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      setShowExportModal(false);
    } catch (err) {
      alert("Export failed. Check console.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- EXCEL PREVIEW GENERATOR ---
  const getPreviewData = () => {
      if (exportType === 'master') {
          return {
              headers: ['DATE', 'FROM', 'TO', 'VEHICLE NO', 'PARTY', 'TOTAL FREIGHT', 'BALANCE', 'DIESEL NEEDED (L)', 'DIESEL LEFT (Taabi)', 'FASTAG EST (Rs)', 'FASTAG ACTUAL (Rs)'],
              rows: [['02 Apr 26', 'BHIWADI', 'JAIPUR', 'RJ14-8674', 'GODREJ', '20,060.00', '0', '150', '250.5', '1725', '1800']]
          };
      }
      if (exportType === 'party') {
          return {
              headers: ['Client Name', 'Total Trips', 'Business (Rs)', 'Pending (Rs)', 'Diesel Needed (L)', 'Fastag Est (Rs)', 'Fastag Actual (Rs)', 'Status'],
              rows: [['GODREJ INDUSTRIES', '45', '850,000.00', '45,000.00', '6500.00', '70000.00', '78500.00', 'Payment Pending']]
          };
      }
      if (['today', 'active', 'completed'].includes(exportType)) {
          return {
              headers: ['Tracking No', 'Launch Date', 'Vehicle', 'Route', 'Party Name', 'Freight (Rs)', 'Diesel Needed (L)', 'Diesel Left (Taabi)', 'Fastag Est (Rs)', 'Fastag Actual (Rs)'],
              rows: [['RJ14-GODR-020426-1', '2026-04-02', 'RJ14-8674', 'BHIWADI to JAIPUR', 'GODREJ', '17000', '150', '250.5', '1725', '1800']]
          };
      }
      if (exportType === 'custom') {
          const headers = Object.keys(exportCols).filter(k => exportCols[k]).map(k => colLabels[k]);
          const row = [];
          if (exportCols.tracking_number) row.push('RJ14-GODR-020426-1');
          if (exportCols.trip_start_date) row.push('2026-04-02');
          if (exportCols.vehicle_number) row.push('RJ14-8674');
          if (exportCols.route) row.push('BHIWADI to JAIPUR');
          if (exportCols.party_name) row.push('GODREJ');
          if (exportCols.freight_amount) row.push('17000');
          if (exportCols.balance_payment) row.push('0');
          if (exportCols.pod_status) row.push('Client Received');
          if (exportCols.diesel_needed) row.push('150');
          if (exportCols.diesel_left) row.push('250.5');
          if (exportCols.fastag_est) row.push('1725');
          if (exportCols.fastag_act) row.push('1800');
          return { headers, rows: [row] };
      }
      return { headers: [], rows: [] };
  };

  const kpiCards = [
    { title: "Active Trucks", value: stats.activeTrucks, subtext: `${stats.availableTrucks} Available`, icon: Truck, path: "/fleet", color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Total Drivers", value: stats.totalDrivers, subtext: "Registered Fleet", icon: Users, path: "/driver-history", color: "text-slate-600", bg: "bg-slate-100" },
    { title: "Active Trips", value: stats.activeTrips, subtext: "Currently En Route", icon: MapPin, path: "/trips", color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Pending PODs", value: stats.pendingPods, subtext: "Requires Action", icon: Receipt, path: "/trips", color: "text-rose-600", bg: "bg-rose-50", alert: stats.pendingPods > 0 },
  ];

  const preview = getPreviewData();

  if (loading && !showExportModal) {
    return <div className="flex h-[80vh] items-center justify-center text-gray-500"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading Live Dashboard...</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Live metrics from your database</p>
        </div>
        <button onClick={() => setShowExportModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition flex items-center gap-2 text-sm cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" /> Reports & Excel Export
        </button>
      </div>

      {/* DRIVER WARNING BANNER */}
      {expiringDrivers.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center font-bold"><AlertCircle className="h-5 w-5" /></div>
            <div>
              <h4 className="font-bold text-rose-900 text-sm">Driver License Warning</h4>
              <p className="text-xs text-rose-700">{expiringDrivers.length} driver(s) have licenses expiring soon or already expired.</p>
            </div>
          </div>
          <button onClick={() => setShowDriverModal(true)} className="bg-rose-600 text-white text-xs px-4 py-2 rounded-lg font-semibold hover:bg-rose-700 transition shadow-sm cursor-pointer">Review Drivers</button>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => (
          <div key={idx} onClick={() => navigate(kpi.path)} className={`bg-white p-5 rounded-xl border border-gray-200 cursor-pointer transition-all hover:border-gray-400 hover:shadow-sm flex flex-col justify-between h-32 ${kpi.alert ? 'border-rose-200 shadow-[0_0_10px_rgba(225,29,72,0.05)]' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="text-sm font-medium text-gray-500">{kpi.title}</div>
              <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}><kpi.icon className="h-4 w-4" /></div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{kpi.value}</div>
              <div className={`text-xs font-medium mt-1 ${kpi.alert ? 'text-rose-600' : 'text-gray-400'}`}>{kpi.subtext}</div>
            </div>
          </div>
        ))}
      </div>

      {/* RECENT TRIPS TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-semibold text-gray-800">Recent Active Trips</h3>
          <button onClick={() => navigate('/trips')} className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 transition cursor-pointer">View All <ArrowRight className="h-4 w-4" /></button>
        </div>
        {recentTrips.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-3">Tracking No.</th>
                <th className="px-6 py-3">Vehicle</th>
                <th className="px-6 py-3">Route</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentTrips.map((trip) => (
                <tr key={trip.trip_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-blue-600">{trip.tracking_number || `Trip #${trip.trip_id}`}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{trip.vehicle_number}</td>
                  <td className="px-6 py-4 text-gray-600">{trip.source_city} → {trip.destination_city}</td>
                  <td className="px-6 py-4 text-gray-600">{trip.party_name || '-'}</td>
                  <td className="px-6 py-4 text-right"><span className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">In-Transit</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-10 text-center text-gray-500">No active trips currently in the system.</div>
        )}
      </div>

      {/* EXCEL REPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-5xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200 h-[85vh] md:h-auto">
            
            {/* Left Sidebar */}
            <div className="w-full md:w-1/3 bg-gray-50 border-r border-gray-200 p-5 flex flex-col gap-2 overflow-y-auto">
               <h3 className="font-bold text-gray-900 mb-2 uppercase text-xs tracking-wider">Select Report Type</h3>
               {[
                 { id: 'master', icon: Table, title: "Detailed Trip Report", desc: "Complete financial ledger." },
                 { id: 'today', icon: FileText, title: "Today's Dispatches", desc: "Trips launched today." },
                 { id: 'active', icon: MapPin, title: "Active Routes", desc: "Currently running trips." },
                 { id: 'completed', icon: CheckCircle2, title: "Completed Trips", desc: "Full delivery history." },
                 { id: 'party', icon: BriefcaseBusiness, title: "Client Ledger", desc: "0-Balance vs Pending clients." },
                 { id: 'custom', icon: Settings2, title: "Custom Telemetry", desc: "Fastag & Taabi Diesel data." }
               ].map(opt => (
                  <div 
                     key={opt.id} 
                     onClick={() => setExportType(opt.id)}
                     className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${exportType === opt.id ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-transparent hover:bg-gray-100 text-gray-600'}`}
                  >
                     <opt.icon className={`h-5 w-5 mt-0.5 ${exportType === opt.id ? 'text-emerald-600' : 'text-gray-400'}`}/>
                     <div>
                        <div className={`font-bold text-sm ${exportType === opt.id ? 'text-emerald-900' : 'text-gray-700'}`}>{opt.title}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
                     </div>
                  </div>
               ))}
            </div>

            {/* Right Side */}
            <div className="w-full md:w-2/3 p-6 flex flex-col justify-between bg-white overflow-y-auto">
               <div>
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                         <FileSpreadsheet className="h-5 w-5 text-emerald-600"/> Report Configuration
                      </h2>
                      <button onClick={() => setShowExportModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition cursor-pointer"><X className="h-5 w-5" /></button>
                  </div>

                  {/* Configuration Controls */}
                  {exportType === 'custom' ? (
                      <div className="space-y-4 animate-in fade-in mb-6">
                          <div>
                              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">1. Select Trip Status</label>
                              <select className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-semibold outline-none cursor-pointer" value={customStatus} onChange={e => setCustomStatus(e.target.value)}>
                                  <option value="All">All Database Trips (Active + Completed)</option>
                                  <option value="Active">Only Active / Running Trips</option>
                                  <option value="Completed">Only Completed / Delivered Trips</option>
                              </select>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">2. Select Telemetry Data to Export</label>
                              <div className="grid grid-cols-2 gap-2">
                                  {Object.keys(exportCols).map(key => (
                                      <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition">
                                          <input type="checkbox" className="h-4 w-4 rounded text-emerald-600 cursor-pointer" checked={exportCols[key]} onChange={(e) => setExportCols({...exportCols, [key]: e.target.checked})} />
                                          <span className="text-[11px] font-semibold text-gray-700">{colLabels[key]}</span>
                                      </label>
                                  ))}
                              </div>
                          </div>
                      </div>
                  ) : ['master', 'active', 'completed'].includes(exportType) ? (
                      <div className="mb-6 w-full max-w-sm">
                          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">Filter Data To Export</label>
                          <select className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-semibold outline-none cursor-pointer" value={customStatus} onChange={e => setCustomStatus(e.target.value)}>
                              <option value="All">Export All Trips</option>
                              <option value="Active">Export Only Active Trips</option>
                              <option value="Completed">Export Only Completed Trips</option>
                          </select>
                      </div>
                  ) : null}

                  {/* 🌟 LIVE EXCEL PREVIEW BOX */}
                  <div className="border border-emerald-200 rounded-lg overflow-hidden shadow-sm bg-white animate-in fade-in">
                      <div className="bg-emerald-50/50 border-b border-emerald-100 px-3 py-2 flex items-center justify-between">
                          <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                             <Table className="h-4 w-4" /> Excel File Preview
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-600 uppercase bg-emerald-100 px-2 py-0.5 rounded">Sample Data</span>
                      </div>
                      <div className="overflow-x-auto max-w-full">
                          <table className="w-full text-left whitespace-nowrap text-[11px] font-mono">
                             <thead className="bg-gray-100 border-b border-gray-200 text-gray-700">
                                <tr>
                                   {preview.headers.length > 0 ? preview.headers.map((h, i) => (
                                      <th key={i} className="p-2 border-r border-gray-200 font-bold bg-slate-200/50">{h}</th>
                                   )) : <th className="p-2 text-rose-500">Select at least one column.</th>}
                                </tr>
                             </thead>
                             <tbody>
                                {preview.rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-blue-50/50 transition">
                                       {row.map((cell, cIdx) => (
                                           <td key={cIdx} className="p-2 border-r border-gray-100 border-b border-gray-100 text-gray-600">{cell}</td>
                                       ))}
                                    </tr>
                                ))}
                             </tbody>
                          </table>
                      </div>
                  </div>

               </div>

               <div className="pt-6 mt-4 border-t flex justify-end gap-3 shrink-0">
                  <button onClick={() => setShowExportModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer">Cancel</button>
                  <button onClick={generateReport} className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer">
                     {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>} 
                     Generate & Download Excel
                  </button>
               </div>
            </div>

          </div>
        </div>
      )}

      {/* DRIVER EXPIRY MODAL */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-500" />
                <h2 className="text-lg font-bold text-gray-900">Action Required: License Renewals</h2>
              </div>
              <button onClick={() => setShowDriverModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {expiringDrivers.map((driver, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div>
                      <div className="font-bold text-gray-900 text-base">{driver.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">DL: <span className="font-mono text-gray-700">{driver.dl_number}</span></div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${driver.status === 'Expired' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{driver.status}</span>
                      <div className="text-xs text-gray-500 mt-2 font-medium">Expires: {driver.dl_expiry_date}</div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowDriverModal(false)} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg cursor-pointer">Done</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;