import React, { useState, useEffect, useCallback } from "react";

// ── Supabase config ─────────────────────────────────────────────────────────
const SUPA_URL = "https://afnzxvwqixjeemlnlmnj.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbnp4dndxaXhqZWVtbG5sbW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTU3MTksImV4cCI6MjA5ODA5MTcxOX0.uhGKz56fBMb-QdztEoq8k3t5hBmr2NepUCzNJm8g_8k";
const HEADERS = { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" };

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, { ...opts, headers: { ...HEADERS, ...(opts.headers||{}) } });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function jobToRow(j) {
  return { id:j.id, customer:j.customer, phone:j.phone, address:j.address, size:j.size, status:j.status, driver:j.driver, scheduled_date:j.scheduledDate, notes:j.notes, invoice:j.invoice, paid:j.paid, dumpster_id:j.dumpsterId||null, texts:j.texts||[] };
}
function rowToJob(r) {
  return { id:r.id, customer:r.customer, phone:r.phone, address:r.address, size:r.size, status:r.status, driver:r.driver, scheduledDate:r.scheduled_date, notes:r.notes, invoice:r.invoice, paid:r.paid, dumpsterId:r.dumpster_id, texts:r.texts||[] };
}
function dumpToRow(d) { return { id:d.id, size:d.size, status:d.status, condition:d.condition, notes:d.notes }; }

// ── Brand ────────────────────────────────────────────────────────────────────
const ORANGE = "#E8590C";
const DUMPSTER_SIZES = ["15 yd", "20 yd"];
const JOB_STATUSES = ["Scheduled", "Out for Delivery", "Dropped Off", "Picked Up", "Completed"];
const STATUS_COLORS = {
  "Scheduled":        { bg:"#2A2000", text:"#FFAA00", dot:"#FFAA00" },
  "Out for Delivery": { bg:"#0E2A0E", text:"#5CCC6C", dot:"#5CCC6C" },
  "Dropped Off":      { bg:"#2A1800", text:"#E8590C", dot:"#E8590C" },
  "Picked Up":        { bg:"#1A1A2A", text:"#9999FF", dot:"#9999FF" },
  "Completed":        { bg:"#0D1F0D", text:"#66CC88", dot:"#66CC88" },
};
const DUMPSTER_STATUS_COLORS = {
  "Available":    { bg:"#0E2A0E", text:"#5CCC6C" },
  "In Transit":   { bg:"#2A2000", text:"#FFAA00" },
  "On-Site":      { bg:"#2A1800", text:ORANGE },
  "Maintenance":  { bg:"#1A1A2A", text:"#9999FF" },
};

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle  = { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #333", fontSize:14, boxSizing:"border-box", outline:"none", background:"#1E1E1E", color:"#FFF" };
const selectStyle = { ...inputStyle, cursor:"pointer" };
const labelStyle  = { fontSize:11, fontWeight:700, color:"#888", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.5px" };
const cardStyle   = { background:"#1A1A1A", borderRadius:12, border:"1px solid #222" };
const btnPrimary  = { background:ORANGE, color:"#FFF", border:"none", borderRadius:8, fontWeight:800, cursor:"pointer" };

function ApexLogo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 90" fill="none">
      <polygon points="50,0 100,90 0,90" fill={ORANGE} />
      <polygon points="50,22 76,72 24,72" fill="#111" />
    </svg>
  );
}

function generateId() { return Math.random().toString(36).substr(2,6).toUpperCase(); }

function dumpsterStatusFromJobs(dumpId, jobs) {
  const job = jobs.find(j => j.dumpsterId === dumpId && j.status !== "Completed");
  if (!job) return "Available";
  if (job.status === "Dropped Off" || job.status === "Picked Up") return "On-Site";
  return "In Transit";
}

function smsTemplates(job) {
  return {
    delivery: `Hi ${job.customer.split(" ")[0]}! Your ${job.size} dumpster from Apex Dumpsters has been delivered to ${job.address}. Questions? Call us: 989-459-2739`,
    pickup:   `Hi ${job.customer.split(" ")[0]}! Apex Dumpsters will be picking up your dumpster at ${job.address} soon. Please make sure it's accessible. 989-459-2739`,
    payment:  `Hi ${job.customer.split(" ")[0]}! Your Apex Dumpsters invoice of $${job.invoice} is due. Please call us to pay: 989-459-2739. Thank you!`,
  };
}

// Open address in maps app
function openMaps(address) {
  const encoded = encodeURIComponent(address);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  window.open(isIOS ? `maps://maps.apple.com/?q=${encoded}` : `https://www.google.com/maps/search/?api=1&query=${encoded}`, "_blank");
}

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function tryLogin() {
    if (pin === "1234") { onLogin("owner"); }
    else if (pin === "0000") { onLogin("driver"); }
    else { setError("Incorrect PIN. Try again."); setPin(""); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#111", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, padding:20 }}>
      <ApexLogo size={70} />
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:24, fontWeight:900, color:"#FFF" }}>APEX <span style={{ color:ORANGE }}>DUMPSTERS</span></div>
        <div style={{ fontSize:12, color:"#555", marginTop:4, letterSpacing:"1px", textTransform:"uppercase" }}>Bay City, MI</div>
      </div>
      <div style={{ ...cardStyle, padding:32, width:"100%", maxWidth:340 }}>
        <div style={{ fontSize:14, color:"#888", marginBottom:16, textAlign:"center" }}>Enter your PIN to continue</div>
        <input
          type="password" inputMode="numeric" maxLength={6}
          value={pin} onChange={e => { setPin(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && tryLogin()}
          placeholder="••••"
          style={{ ...inputStyle, fontSize:24, textAlign:"center", letterSpacing:8, marginBottom:12 }}
          autoFocus
        />
        {error && <div style={{ color:"#FF5555", fontSize:13, marginBottom:12, textAlign:"center" }}>{error}</div>}
        <button onClick={tryLogin} style={{ ...btnPrimary, width:"100%", padding:13, fontSize:16, borderRadius:8 }}>Sign In</button>
        <div style={{ marginTop:20, fontSize:11, color:"#444", textAlign:"center", lineHeight:1.8 }}>
          Owner PIN: 1234 &nbsp;·&nbsp; Driver PIN: 0000
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [role, setRole]           = useState(null); // null | "owner" | "driver"
  const [view, setView]           = useState("dashboard");
  const [jobs, setJobs]           = useState([]);
  const [dumpsters, setDumpsters] = useState([]);
  const [drivers, setDrivers]     = useState(["Mike T.", "Dave R.", "Chris L."]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [formData, setFormData]   = useState({});
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDriver, setFilterDriver] = useState("All");
  const [search, setSearch]       = useState("");
  const [dumpSearch, setDumpSearch] = useState("");
  const [dumpFilter, setDumpFilter] = useState("All");
  const [smsModal, setSmsModal]   = useState(null);
  const [smsType, setSmsType]     = useState("delivery");
  const [toast, setToast]         = useState("");
  const [editDump, setEditDump]   = useState(null);
  const [newDump, setNewDump]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [showDriverMgr, setShowDriverMgr] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }
  const isOwner = role === "owner";

  // ── Load data ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [jobRows, dumpRows] = await Promise.all([
        sbFetch("/jobs?order=created_at.desc"),
        sbFetch("/dumpsters?order=id.asc"),
      ]);
      setJobs((jobRows||[]).map(rowToJob));
      setDumpsters(dumpRows||[]);
      setError("");
    } catch(e) {
      setError("Cannot reach database. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (role) loadAll(); }, [role, loadAll]);
  useEffect(() => {
    if (!role) return;
    const id = setInterval(loadAll, 8000);
    return () => clearInterval(id);
  }, [role, loadAll]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0,10);
  const stats = {
    total:       jobs.length,
    active:      jobs.filter(j => j.status !== "Completed").length,
    today:       jobs.filter(j => j.scheduledDate === today).length,
    unpaid:      jobs.filter(j => !j.paid && j.status === "Completed").length,
    revenue:     jobs.filter(j => j.paid).reduce((s,j) => s+j.invoice, 0),
    outstanding: jobs.filter(j => !j.paid).reduce((s,j) => s+j.invoice, 0),
    available:   dumpsters.filter(d => d.status === "Available").length,
    onSite:      dumpsters.filter(d => d.status === "On-Site").length,
    inTransit:   dumpsters.filter(d => d.status === "In Transit").length,
    maintenance: dumpsters.filter(d => d.status === "Maintenance").length,
  };

  const filteredJobs = jobs.filter(j => {
    const ms = filterStatus === "All" || j.status === filterStatus;
    const md = filterDriver === "All" || j.driver === filterDriver;
    const mq = !search || j.customer.toLowerCase().includes(search.toLowerCase()) || j.address.toLowerCase().includes(search.toLowerCase()) || j.id.includes(search.toUpperCase());
    return ms && md && mq;
  });
  const filteredDumps = dumpsters.filter(d => {
    const ms = dumpFilter === "All" || d.status === dumpFilter;
    const mq = !dumpSearch || d.id.toLowerCase().includes(dumpSearch.toLowerCase()) || d.size.includes(dumpSearch);
    return ms && mq;
  });

  // ── Job CRUD ─────────────────────────────────────────────────────────────
  const emptyJob = { customer:"", phone:"", address:"", size:"15 yd", status:"Scheduled", driver:drivers[0]||"Unassigned", scheduledDate:"", notes:"", invoice:325, paid:false, dumpsterId:"", texts:[] };

  function openNew()   { setFormData({ ...emptyJob, id:"APX"+generateId() }); setSelectedJob(null); setShowForm(true); }
  function openEdit(j) { setFormData({ ...j }); setSelectedJob(j); setShowForm(true); }

  async function saveJob() {
    if (!formData.customer || !formData.address || !formData.scheduledDate) return;
    setSaving(true);
    try {
      const row = jobToRow(formData);
      if (selectedJob) {
        await sbFetch(`/jobs?id=eq.${formData.id}`, { method:"PATCH", body:JSON.stringify(row) });
        if (formData.dumpsterId) {
          const s = dumpsterStatusFromJobs(formData.dumpsterId, jobs.map(j => j.id===formData.id ? formData : j));
          await sbFetch(`/dumpsters?id=eq.${formData.dumpsterId}`, { method:"PATCH", body:JSON.stringify({ status:s }) });
        }
      } else {
        await sbFetch("/jobs", { method:"POST", body:JSON.stringify(row) });
        if (formData.dumpsterId) {
          await sbFetch(`/dumpsters?id=eq.${formData.dumpsterId}`, { method:"PATCH", body:JSON.stringify({ status:"In Transit" }) });
        }
      }
      await loadAll(); setShowForm(false);
      showToast(selectedJob ? "Job updated!" : "Job created!");
    } catch(e) { showToast("Error saving job."); }
    setSaving(false);
  }

  async function deleteJob(id) {
    if (!window.confirm("Remove this job?")) return;
    setSaving(true);
    try {
      const job = jobs.find(j => j.id === id);
      await sbFetch(`/jobs?id=eq.${id}`, { method:"DELETE" });
      if (job?.dumpsterId) await sbFetch(`/dumpsters?id=eq.${job.dumpsterId}`, { method:"PATCH", body:JSON.stringify({ status:"Available" }) });
      await loadAll(); setShowForm(false); showToast("Job deleted.");
    } catch(e) { showToast("Error deleting job."); }
    setSaving(false);
  }

  async function togglePaid(id) {
    const job = jobs.find(j => j.id === id);
    try {
      await sbFetch(`/jobs?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ paid:!job.paid }) });
      await loadAll();
    } catch(e) { showToast("Error updating payment."); }
  }

  async function updateStatus(id, status) {
    const job = jobs.find(j => j.id === id);
    try {
      const dumpsterId = status === "Completed" ? null : job.dumpsterId;
      await sbFetch(`/jobs?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ status, dumpster_id:dumpsterId }) });
      if (job.dumpsterId) {
        const ns = status === "Completed" ? "Available" : dumpsterStatusFromJobs(job.dumpsterId, jobs.map(j => j.id===id ? { ...j, status } : j));
        await sbFetch(`/dumpsters?id=eq.${job.dumpsterId}`, { method:"PATCH", body:JSON.stringify({ status:ns }) });
      }
      await loadAll();
    } catch(e) { showToast("Error updating status."); }
  }

  // ── SMS ──────────────────────────────────────────────────────────────────
  async function sendSms(job, type, msg) {
    try {
      const newTexts = [{ type, msg, ts:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) }, ...(job.texts||[])];
      await sbFetch(`/jobs?id=eq.${job.id}`, { method:"PATCH", body:JSON.stringify({ texts:newTexts }) });
      await loadAll(); setSmsModal(null);
      showToast(`Text sent to ${job.customer}!`);
    } catch(e) { showToast("Error logging text."); }
  }

  // ── Dumpster CRUD ─────────────────────────────────────────────────────────
  async function saveDump(dump) {
    try {
      await sbFetch(`/dumpsters?id=eq.${dump.id}`, { method:"PATCH", body:JSON.stringify(dumpToRow(dump)) });
      await loadAll(); setEditDump(null); showToast("Unit saved!");
    } catch(e) { showToast("Error saving unit."); }
  }

  async function addUnit(unit) {
    const prefix = unit.size === "15 yd" ? "D15" : "D20";
    const existing = dumpsters.filter(d => d.id.startsWith(prefix));
    const nextNum = String(existing.length + 1).padStart(2,"0");
    const newUnit = { id:`${prefix}-${nextNum}`, size:unit.size, status:"Available", condition:unit.condition, notes:unit.notes };
    try {
      await sbFetch("/dumpsters", { method:"POST", body:JSON.stringify(newUnit) });
      await loadAll(); setNewDump(false); showToast(`Unit ${newUnit.id} added!`);
    } catch(e) { showToast("Error adding unit."); }
  }

  // ── Driver management ─────────────────────────────────────────────────────
  function addDriver() {
    const name = newDriverName.trim();
    if (!name || drivers.includes(name)) return;
    setDrivers([...drivers, name]);
    setNewDriverName("");
    showToast(`${name} added!`);
  }
  function deleteDriver(name) {
    if (!window.confirm(`Remove ${name}?`)) return;
    setDrivers(drivers.filter(d => d !== name));
    showToast(`${name} removed.`);
  }

  // ── Nav ───────────────────────────────────────────────────────────────────
  const ownerNav  = ["dashboard","jobs","routes","invoices","inventory","texts","settings"];
  const driverNav = ["routes","jobs"];
  const navItems  = isOwner ? ownerNav : driverNav;
  const navLabels = { dashboard:"Dashboard", jobs:"Jobs", routes:"Routes", invoices:"Invoices", inventory:"Inventory", texts:"Texts", settings:"Settings" };

  // ── Login gate ────────────────────────────────────────────────────────────
  if (!role) return <LoginScreen onLogin={r => { setRole(r); setView(r === "driver" ? "routes" : "dashboard"); }} />;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#111", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#FFF", gap:16 }}>
      <ApexLogo size={60} />
      <div style={{ fontSize:20, fontWeight:800 }}>APEX <span style={{ color:ORANGE }}>DUMPSTERS</span></div>
      <div style={{ color:"#666", fontSize:14 }}>Connecting to database…</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"100vh", background:"#111", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#FFF", gap:16 }}>
      <ApexLogo size={60} />
      <div style={{ color:"#FF5555", fontSize:16, fontWeight:700 }}>{error}</div>
      <button onClick={loadAll} style={{ ...btnPrimary, padding:"10px 24px", fontSize:14, borderRadius:8 }}>Retry</button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#111", fontFamily:"'Inter',system-ui,sans-serif", color:"#FFF" }}>

      {/* HEADER */}
      <div style={{ background:"#000", borderBottom:`2px solid ${ORANGE}`, padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:62, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <ApexLogo size={36} />
          <div>
            <div style={{ fontWeight:900, fontSize:17 }}>APEX <span style={{ color:ORANGE }}>DUMPSTERS</span></div>
            <div style={{ fontSize:10, color:"#555", letterSpacing:"1px", textTransform:"uppercase" }}>Bay City, MI · 989-459-2739</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#5CCC6C", boxShadow:"0 0 6px #5CCC6C" }} />
          <span style={{ fontSize:11, color:"#5CCC6C", fontWeight:700 }}>LIVE</span>
          <span style={{ fontSize:11, color:"#555", marginLeft:8, background:"#1A1A1A", padding:"3px 10px", borderRadius:20, fontWeight:700, textTransform:"uppercase" }}>{role}</span>
          <nav style={{ display:"flex", gap:4, flexWrap:"wrap", marginLeft:8 }}>
            {navItems.map(k => (
              <button key={k} onClick={() => setView(k)} style={{ background:view===k?ORANGE:"transparent", color:view===k?"#FFF":"#888", border:view===k?"none":"1px solid #2A2A2A", borderRadius:6, padding:"7px 14px", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                {navLabels[k]}
              </button>
            ))}
          </nav>
          <button onClick={() => setRole(null)} style={{ background:"transparent", border:"1px solid #333", borderRadius:6, color:"#666", padding:"6px 12px", fontSize:12, cursor:"pointer", marginLeft:4 }}>Sign Out</button>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", background:"#5CCC6C", color:"#000", padding:"12px 24px", borderRadius:12, fontWeight:800, fontSize:15, zIndex:400, boxShadow:"0 4px 20px rgba(0,0,0,0.5)", whiteSpace:"nowrap" }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px" }}>

        {/* ══ DASHBOARD (owner only) ══ */}
        {view === "dashboard" && isOwner && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:6 }}>
              <ApexLogo size={44} />
              <div>
                <h1 style={{ fontSize:26, fontWeight:900, margin:0 }}>Good morning 👋</h1>
                <p style={{ color:"#666", margin:0, fontSize:14 }}>Bay City, MI · {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p>
              </div>
            </div>
            <div style={{ height:1, background:"#222", margin:"20px 0 28px" }} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:14, marginBottom:32 }}>
              {[
                { label:"Jobs Today",  value:stats.today,                              accent:ORANGE },
                { label:"Active Jobs", value:stats.active,                             accent:"#FFAA00" },
                { label:"Available",   value:`${stats.available} units`,               accent:"#5CCC6C" },
                { label:"On-Site",     value:`${stats.onSite} units`,                  accent:ORANGE },
                { label:"Revenue",     value:`$${stats.revenue.toLocaleString()}`,     accent:"#5CCC6C" },
                { label:"Outstanding", value:`$${stats.outstanding.toLocaleString()}`, accent:"#FF5555" },
              ].map(s => (
                <div key={s.label} style={{ ...cardStyle, padding:"18px 16px", borderLeft:`4px solid ${s.accent}` }}>
                  <div style={{ fontSize:26, fontWeight:900, color:s.accent }}>{s.value}</div>
                  <div style={{ fontSize:11, color:"#666", marginTop:4, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              <div style={{ ...cardStyle, padding:20 }}>
                <div style={{ fontWeight:800, marginBottom:14, fontSize:15, color:ORANGE }}>Today's Jobs</div>
                {jobs.filter(j => j.scheduledDate===today).length===0 && <div style={{ color:"#555", fontSize:14 }}>No jobs today.</div>}
                {jobs.filter(j => j.scheduledDate===today).map(j => (
                  <div key={j.id} onClick={() => openEdit(j)} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #222", cursor:"pointer" }}>
                    <div style={{ background:STATUS_COLORS[j.status].dot, width:10, height:10, borderRadius:"50%", flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{j.customer}</div>
                      <button onClick={e => { e.stopPropagation(); openMaps(j.address); }} style={{ background:"none", border:"none", color:"#5CCC6C", fontSize:12, cursor:"pointer", padding:0, textDecoration:"underline" }}>{j.address}</button>
                    </div>
                    <div style={{ fontSize:11, background:STATUS_COLORS[j.status].bg, color:STATUS_COLORS[j.status].text, padding:"2px 8px", borderRadius:20, fontWeight:700 }}>{j.status}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...cardStyle, padding:20 }}>
                <div style={{ fontWeight:800, marginBottom:14, fontSize:15, color:ORANGE }}>Unpaid — Completed</div>
                {jobs.filter(j => !j.paid && j.status==="Completed").length===0 && <div style={{ color:"#555", fontSize:14 }}>All clear 🎉</div>}
                {jobs.filter(j => !j.paid && j.status==="Completed").map(j => (
                  <div key={j.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #222" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{j.customer}</div>
                      <div style={{ fontSize:12, color:"#666" }}>{j.id} · {j.size}</div>
                    </div>
                    <div style={{ fontWeight:800, color:"#FF5555" }}>${j.invoice}</div>
                    <button onClick={() => togglePaid(j.id)} style={{ ...btnPrimary, background:"#5CCC6C", color:"#000", padding:"4px 10px", fontSize:12, borderRadius:6 }}>Mark Paid</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ JOBS ══ */}
        {view === "jobs" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h1 style={{ fontSize:22, fontWeight:900, margin:0 }}>All Jobs</h1>
              {isOwner && <button onClick={openNew} style={{ ...btnPrimary, padding:"10px 20px", fontSize:14, borderRadius:8 }}>+ New Job</button>}
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, address, ID…" style={{ ...inputStyle, flex:1, minWidth:200 }} />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
                <option value="All">All Statuses</option>
                {JOB_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)} style={selectStyle}>
                <option value="All">All Drivers</option>
                {drivers.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ ...cardStyle, overflow:"hidden" }}>
              {filteredJobs.length===0 && <div style={{ padding:32, textAlign:"center", color:"#555" }}>No jobs found.</div>}
              {filteredJobs.map((j,i) => (
                <div key={j.id}
                  style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom:i<filteredJobs.length-1?"1px solid #222":"none", cursor:"pointer" }}
                  onClick={() => isOwner && openEdit(j)}
                  onMouseEnter={e => e.currentTarget.style.background="#1F1F1F"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <div style={{ width:60, fontSize:11, fontWeight:800, color:ORANGE }}>{j.id}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>{j.customer}</div>
                    <button onClick={e => { e.stopPropagation(); openMaps(j.address); }} style={{ background:"none", border:"none", color:"#5CCC6C", fontSize:12, cursor:"pointer", padding:0, textDecoration:"underline", textAlign:"left" }}>📍 {j.address}</button>
                  </div>
                  <div style={{ fontSize:12, color:"#666", width:90 }}>{j.scheduledDate}</div>
                  <div style={{ fontSize:13, fontWeight:700, width:55, color:ORANGE }}>{j.size}</div>
                  <div style={{ fontSize:12, width:75, color:"#888" }}>{j.driver}</div>
                  {j.dumpsterId && <div style={{ fontSize:11, color:"#555", width:70 }}>{j.dumpsterId}</div>}
                  <div style={{ fontSize:11, background:STATUS_COLORS[j.status].bg, color:STATUS_COLORS[j.status].text, padding:"3px 10px", borderRadius:20, fontWeight:700, whiteSpace:"nowrap" }}>{j.status}</div>
                  {isOwner && (
                    <>
                      <div style={{ fontSize:13, fontWeight:800, color:j.paid?"#5CCC6C":"#FF5555", width:68, textAlign:"right" }}>${j.invoice}<br/><span style={{ fontSize:10 }}>{j.paid?"Paid":"Unpaid"}</span></div>
                      <button onClick={e => { e.stopPropagation(); setSmsModal(j); setSmsType("delivery"); }} style={{ background:"#1E2A1E", color:"#5CCC6C", border:"1px solid #5CCC6C", borderRadius:6, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>📱 Text</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ ROUTES ══ */}
        {view === "routes" && (
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, marginBottom:20 }}>Driver Routes</h1>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20 }}>
              {drivers.map(driver => {
                const driverJobs = jobs.filter(j => j.driver===driver && j.status!=="Completed");
                // driver view: only show their own jobs if logged in as driver
                if (!isOwner && filterDriver !== "All" && driver !== filterDriver) return null;
                return (
                  <div key={driver} style={{ ...cardStyle, padding:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                      <div style={{ background:ORANGE, color:"#FFF", borderRadius:8, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14 }}>
                        {driver.split(" ")[0][0]}{driver.split(" ").slice(-1)[0][0]}
                      </div>
                      <div>
                        <div style={{ fontWeight:800, fontSize:15 }}>{driver}</div>
                        <div style={{ fontSize:12, color:"#666" }}>{driverJobs.length} active stop{driverJobs.length!==1?"s":""}</div>
                      </div>
                    </div>
                    {driverJobs.length===0 && <div style={{ color:"#555", fontSize:13 }}>No active jobs.</div>}
                    {driverJobs.map((j,i) => (
                      <div key={j.id} style={{ display:"flex", gap:10, padding:"10px 0", borderBottom:i<driverJobs.length-1?"1px solid #222":"none" }}>
                        <div style={{ background:ORANGE, color:"#FFF", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, flexShrink:0, marginTop:2 }}>{i+1}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:14 }}>{j.customer}</div>
                          <button onClick={() => openMaps(j.address)} style={{ background:"none", border:"none", color:"#5CCC6C", fontSize:12, cursor:"pointer", padding:0, textDecoration:"underline", textAlign:"left" }}>📍 {j.address}</button>
                          {j.dumpsterId && <div style={{ fontSize:11, color:"#555", marginTop:2 }}>Unit: {j.dumpsterId}</div>}
                          {j.notes && <div style={{ fontSize:11, color:"#888", marginTop:2, fontStyle:"italic" }}>"{j.notes}"</div>}
                          <div style={{ marginTop:6 }}>
                            <span style={{ fontSize:11, background:STATUS_COLORS[j.status].bg, color:STATUS_COLORS[j.status].text, padding:"2px 8px", borderRadius:20, fontWeight:700 }}>{j.status}</span>
                          </div>
                          <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                            {JOB_STATUSES.filter(s => s!==j.status && s!=="Completed").map(s => (
                              <button key={s} onClick={() => updateStatus(j.id,s)} style={{ fontSize:11, background:"#2A2A2A", color:"#CCC", border:"1px solid #333", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontWeight:600 }}>→ {s}</button>
                            ))}
                            <button onClick={() => updateStatus(j.id,"Completed")} style={{ fontSize:11, background:"#5CCC6C", color:"#000", border:"none", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontWeight:800 }}>✓ Done</button>
                            {isOwner && <button onClick={() => { setSmsModal(j); setSmsType("delivery"); }} style={{ fontSize:11, background:"#1E2A1E", color:"#5CCC6C", border:"1px solid #5CCC6C", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontWeight:700 }}>📱</button>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ INVOICES (owner only) ══ */}
        {view === "invoices" && isOwner && (
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, marginBottom:20 }}>Invoices</h1>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:16, marginBottom:28 }}>
              {[
                { label:"Total Invoiced", value:`$${jobs.reduce((s,j)=>s+j.invoice,0).toLocaleString()}`, color:ORANGE },
                { label:"Collected",      value:`$${stats.revenue.toLocaleString()}`,                     color:"#5CCC6C" },
                { label:"Outstanding",    value:`$${stats.outstanding.toLocaleString()}`,                  color:"#FF5555" },
              ].map(s => (
                <div key={s.label} style={{ ...cardStyle, padding:"18px 16px", borderTop:`4px solid ${s.color}` }}>
                  <div style={{ fontSize:26, fontWeight:900, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:11, color:"#666", marginTop:4, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ ...cardStyle, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 100px 65px 75px 140px", padding:"10px 20px", background:"#111", fontSize:11, fontWeight:800, color:"#555", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                <div>ID</div><div>Customer</div><div>Date</div><div>Size</div><div>Amount</div><div>Status</div>
              </div>
              {jobs.map((j,i) => (
                <div key={j.id} style={{ display:"grid", gridTemplateColumns:"80px 1fr 100px 65px 75px 140px", padding:"14px 20px", borderBottom:i<jobs.length-1?"1px solid #222":"none", alignItems:"center" }}>
                  <div style={{ fontSize:12, fontWeight:800, color:ORANGE }}>{j.id}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{j.customer}</div>
                    <div style={{ fontSize:11, color:"#666" }}>{j.phone}</div>
                  </div>
                  <div style={{ fontSize:13, color:"#888" }}>{j.scheduledDate}</div>
                  <div style={{ fontSize:13, color:ORANGE, fontWeight:700 }}>{j.size}</div>
                  <div style={{ fontWeight:800, fontSize:15 }}>${j.invoice}</div>
                  <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:j.paid?"#5CCC6C":"#FF5555" }} />
                    <span style={{ fontSize:13, fontWeight:700, color:j.paid?"#5CCC6C":"#FF5555" }}>{j.paid?"Paid":"Unpaid"}</span>
                    {!j.paid && <button onClick={() => togglePaid(j.id)} style={{ fontSize:11, background:"#5CCC6C", color:"#000", border:"none", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontWeight:800 }}>Collect</button>}
                    {!j.paid && <button onClick={() => { setSmsModal(j); setSmsType("payment"); }} style={{ fontSize:11, background:"#2A0000", color:"#FF5555", border:"1px solid #FF5555", borderRadius:4, padding:"3px 6px", cursor:"pointer", fontWeight:700 }}>📱</button>}
                    {j.paid && <button onClick={() => togglePaid(j.id)} style={{ fontSize:11, background:"#2A2A2A", color:"#666", border:"none", borderRadius:4, padding:"3px 6px", cursor:"pointer" }}>Undo</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ INVENTORY (owner only) ══ */}
        {view === "inventory" && isOwner && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h1 style={{ fontSize:22, fontWeight:900, margin:0 }}>Dumpster Inventory</h1>
              <button onClick={() => setNewDump({ size:"15 yd", condition:"Good", notes:"" })} style={{ ...btnPrimary, padding:"10px 18px", fontSize:14, borderRadius:8 }}>+ Add Unit</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginBottom:28 }}>
              {[
                { label:"Total",       value:dumpsters.length,  color:"#FFF" },
                { label:"Available",   value:stats.available,   color:"#5CCC6C" },
                { label:"On-Site",     value:stats.onSite,      color:ORANGE },
                { label:"In Transit",  value:stats.inTransit,   color:"#FFAA00" },
                { label:"Maintenance", value:stats.maintenance, color:"#9999FF" },
              ].map(s => (
                <div key={s.label} style={{ ...cardStyle, padding:"16px 14px", borderLeft:`4px solid ${s.color}` }}>
                  <div style={{ fontSize:26, fontWeight:900, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:11, color:"#666", marginTop:3, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:18 }}>
              <input value={dumpSearch} onChange={e => setDumpSearch(e.target.value)} placeholder="Search unit ID or size…" style={{ ...inputStyle, flex:1 }} />
              <select value={dumpFilter} onChange={e => setDumpFilter(e.target.value)} style={selectStyle}>
                <option value="All">All Statuses</option>
                {["Available","In Transit","On-Site","Maintenance"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:12 }}>
              {filteredDumps.map(d => {
                const sc = DUMPSTER_STATUS_COLORS[d.status] || DUMPSTER_STATUS_COLORS["Available"];
                const assignedJob = jobs.find(j => j.dumpsterId===d.id && j.status!=="Completed");
                return (
                  <div key={d.id} style={{ ...cardStyle, padding:16, cursor:"pointer" }}
                    onClick={() => setEditDump({ ...d })}
                    onMouseEnter={e => e.currentTarget.style.background="#1F1F1F"}
                    onMouseLeave={e => e.currentTarget.style.background="#1A1A1A"}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div>
                        <div style={{ fontWeight:900, fontSize:16, color:ORANGE }}>{d.id}</div>
                        <div style={{ fontSize:13, color:"#888", marginTop:2 }}>{d.size}</div>
                      </div>
                      <div style={{ background:sc.bg, color:sc.text, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{d.status}</div>
                    </div>
                    {assignedJob && (
                      <div style={{ background:"#111", borderRadius:8, padding:"8px 10px", fontSize:12 }}>
                        <div style={{ fontWeight:700 }}>{assignedJob.customer}</div>
                        <button onClick={e => { e.stopPropagation(); openMaps(assignedJob.address); }} style={{ background:"none", border:"none", color:"#5CCC6C", fontSize:11, cursor:"pointer", padding:0, textDecoration:"underline" }}>📍 {assignedJob.address}</button>
                      </div>
                    )}
                    {d.notes && <div style={{ fontSize:11, color:"#666", marginTop:8 }}>{d.notes}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ TEXTS (owner only) ══ */}
        {view === "texts" && isOwner && (
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, marginBottom:6 }}>Customer Texts</h1>
            <p style={{ color:"#666", fontSize:14, marginBottom:24 }}>Tap a button to open a pre-filled SMS on your phone.</p>
            <div style={{ marginBottom:32 }}>
              <div style={{ fontWeight:800, fontSize:15, color:ORANGE, marginBottom:14 }}>Quick Send</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
                {jobs.filter(j => j.status!=="Completed" || !j.paid).map(j => (
                  <div key={j.id} style={{ ...cardStyle, padding:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:15 }}>{j.customer}</div>
                        <div style={{ fontSize:12, color:"#666" }}>{j.phone} · {j.id}</div>
                      </div>
                      <div style={{ fontSize:11, background:STATUS_COLORS[j.status].bg, color:STATUS_COLORS[j.status].text, padding:"2px 8px", borderRadius:20, fontWeight:700 }}>{j.status}</div>
                    </div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <button onClick={() => { setSmsModal(j); setSmsType("delivery"); }} style={{ ...btnPrimary, padding:"7px 12px", fontSize:12, borderRadius:6 }}>📦 Delivery</button>
                      <button onClick={() => { setSmsModal(j); setSmsType("pickup"); }} style={{ background:"#2A2000", color:"#FFAA00", border:"1px solid #FFAA00", borderRadius:6, padding:"7px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>🚛 Pickup</button>
                      {!j.paid && <button onClick={() => { setSmsModal(j); setSmsType("payment"); }} style={{ background:"#2A0000", color:"#FF5555", border:"1px solid #FF5555", borderRadius:6, padding:"7px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>💵 Payment</button>}
                    </div>
                    {j.texts && j.texts.length>0 && <div style={{ marginTop:10, fontSize:11, color:"#555" }}>Last: {j.texts[0].type} at {j.texts[0].ts}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontWeight:800, fontSize:15, color:ORANGE, marginBottom:14 }}>Message Log</div>
            <div style={{ ...cardStyle, overflow:"hidden" }}>
              {jobs.every(j => !j.texts||j.texts.length===0) && <div style={{ padding:28, textAlign:"center", color:"#555" }}>No messages sent yet.</div>}
              {jobs.flatMap(j => (j.texts||[]).map(t => ({ ...t, customer:j.customer, phone:j.phone }))).map((t,i) => (
                <div key={i} style={{ display:"flex", gap:14, padding:"14px 20px", borderBottom:"1px solid #222", alignItems:"flex-start" }}>
                  <div style={{ background:"#1E2A1E", color:"#5CCC6C", borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>✓ {t.ts}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{t.customer} <span style={{ color:"#555", fontWeight:400, fontSize:12 }}>({t.phone})</span></div>
                    <div style={{ fontSize:12, color:"#888", marginTop:3 }}>{t.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ SETTINGS (owner only) ══ */}
        {view === "settings" && isOwner && (
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, marginBottom:24 }}>Settings</h1>

            {/* Driver Management */}
            <div style={{ ...cardStyle, padding:24, marginBottom:20 }}>
              <div style={{ fontWeight:800, fontSize:16, color:ORANGE, marginBottom:4 }}>Manage Drivers</div>
              <div style={{ fontSize:13, color:"#666", marginBottom:20 }}>Add or remove drivers. Changes apply immediately to job assignments.</div>

              {/* Add driver */}
              <div style={{ display:"flex", gap:10, marginBottom:20 }}>
                <input value={newDriverName} onChange={e => setNewDriverName(e.target.value)} onKeyDown={e => e.key==="Enter" && addDriver()}
                  placeholder="Full name e.g. John S." style={{ ...inputStyle, flex:1 }} />
                <button onClick={addDriver} style={{ ...btnPrimary, padding:"9px 20px", fontSize:14, borderRadius:8, whiteSpace:"nowrap" }}>+ Add Driver</button>
              </div>

              {/* Driver list */}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {drivers.map(d => {
                  const activeJobs = jobs.filter(j => j.driver===d && j.status!=="Completed").length;
                  return (
                    <div key={d} style={{ display:"flex", alignItems:"center", gap:12, background:"#111", borderRadius:10, padding:"12px 16px" }}>
                      <div style={{ background:ORANGE, color:"#FFF", borderRadius:8, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, flexShrink:0 }}>
                        {d.split(" ")[0][0]}{d.split(" ").slice(-1)[0][0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:15 }}>{d}</div>
                        <div style={{ fontSize:12, color:"#666" }}>{activeJobs} active job{activeJobs!==1?"s":""}</div>
                      </div>
                      <button onClick={() => deleteDriver(d)} style={{ background:"#2A0000", color:"#FF5555", border:"1px solid #FF5555", borderRadius:6, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Remove</button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PIN info */}
            <div style={{ ...cardStyle, padding:24 }}>
              <div style={{ fontWeight:800, fontSize:16, color:ORANGE, marginBottom:4 }}>Access PINs</div>
              <div style={{ fontSize:13, color:"#666", marginBottom:16 }}>Share these PINs with your team.</div>
              <div style={{ display:"flex", gap:12 }}>
                <div style={{ flex:1, background:"#111", borderRadius:10, padding:16 }}>
                  <div style={{ fontSize:11, color:"#888", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Owner PIN</div>
                  <div style={{ fontSize:28, fontWeight:900, color:ORANGE, letterSpacing:4 }}>1234</div>
                  <div style={{ fontSize:12, color:"#555", marginTop:4 }}>Full access — all tabs including invoices & money</div>
                </div>
                <div style={{ flex:1, background:"#111", borderRadius:10, padding:16 }}>
                  <div style={{ fontSize:11, color:"#888", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Driver PIN</div>
                  <div style={{ fontSize:28, fontWeight:900, color:"#5CCC6C", letterSpacing:4 }}>0000</div>
                  <div style={{ fontSize:12, color:"#555", marginTop:4 }}>Routes & Jobs only — no financial info</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ JOB MODAL ══ */}
      {showForm && isOwner && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={e => { if (e.target===e.currentTarget) setShowForm(false); }}>
          <div style={{ background:"#1A1A1A", borderRadius:16, width:"100%", maxWidth:540, overflow:"hidden", border:"1px solid #333", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ background:"#000", borderBottom:`2px solid ${ORANGE}`, padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <ApexLogo size={28} />
                <div>
                  <div style={{ fontWeight:900, fontSize:16 }}>{selectedJob?"Edit Job":"New Job"}</div>
                  {formData.id && <div style={{ fontSize:11, color:ORANGE, marginTop:1 }}>#{formData.id}</div>}
                </div>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background:"transparent", border:"none", color:"#666", fontSize:24, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ padding:24, display:"flex", flexDirection:"column", gap:14 }}>
              {[
                { label:"Customer Name",     key:"customer",      type:"text",   placeholder:"e.g. John's Contracting" },
                { label:"Phone Number",      key:"phone",         type:"tel",    placeholder:"989-555-0000" },
                { label:"Drop-off Address",  key:"address",       type:"text",   placeholder:"123 Main St, Bay City, MI" },
                { label:"Scheduled Date",    key:"scheduledDate", type:"date" },
                { label:"Invoice Amount ($)", key:"invoice",      type:"number" },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type={f.type} value={formData[f.key]||""} placeholder={f.placeholder||""}
                    onChange={e => setFormData({ ...formData, [f.key]:f.type==="number"?Number(e.target.value):e.target.value })}
                    style={inputStyle} />
                </div>
              ))}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                {[
                  { label:"Size",   key:"size",   options:DUMPSTER_SIZES },
                  { label:"Driver", key:"driver", options:[...drivers,"Unassigned"] },
                  { label:"Status", key:"status", options:JOB_STATUSES },
                ].map(f => (
                  <div key={f.key}>
                    <label style={labelStyle}>{f.label}</label>
                    <select value={formData[f.key]||""} onChange={e => setFormData({ ...formData, [f.key]:e.target.value })} style={selectStyle}>
                      {f.options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <label style={labelStyle}>Assign Dumpster Unit</label>
                <select value={formData.dumpsterId||""} onChange={e => setFormData({ ...formData, dumpsterId:e.target.value })} style={selectStyle}>
                  <option value="">— Unassigned —</option>
                  {dumpsters.filter(d => d.size===(formData.size||"15 yd") && (d.status==="Available"||d.id===formData.dumpsterId)).map(d => (
                    <option key={d.id} value={d.id}>{d.id} ({d.status})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={formData.notes||""} onChange={e => setFormData({ ...formData, notes:e.target.value })}
                  placeholder="e.g. Place on side of driveway, call on arrival…" rows={2}
                  style={{ ...inputStyle, resize:"vertical" }} />
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                <input type="checkbox" checked={!!formData.paid} onChange={e => setFormData({ ...formData, paid:e.target.checked })} style={{ width:16, height:16, accentColor:ORANGE }} />
                <span style={{ fontSize:14, fontWeight:600 }}>Mark as Paid</span>
              </label>
            </div>
            <div style={{ padding:"0 24px 24px", display:"flex", gap:10 }}>
              <button onClick={saveJob} disabled={saving} style={{ ...btnPrimary, flex:1, padding:12, fontSize:15, borderRadius:8, opacity:saving?0.6:1 }}>
                {saving?"Saving…":selectedJob?"Save Changes":"Create Job"}
              </button>
              {selectedJob && <button onClick={() => { setSmsModal(selectedJob); setSmsType("delivery"); setShowForm(false); }} style={{ background:"#1E2A1E", color:"#5CCC6C", border:"1px solid #5CCC6C", borderRadius:8, padding:"12px 14px", fontWeight:800, fontSize:15, cursor:"pointer" }}>📱</button>}
              {selectedJob && <button onClick={() => deleteJob(formData.id)} style={{ background:"#2A0000", color:"#FF5555", border:"1px solid #FF5555", borderRadius:8, padding:"12px 18px", fontWeight:800, fontSize:15, cursor:"pointer" }}>Delete</button>}
            </div>
          </div>
        </div>
      )}

      {/* ══ SMS MODAL ══ */}
      {smsModal && (() => {
        const tmpls = smsTemplates(smsModal);
        const msg = tmpls[smsType];
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
            onClick={e => { if (e.target===e.currentTarget) setSmsModal(null); }}>
            <div style={{ background:"#1A1A1A", borderRadius:16, width:"100%", maxWidth:460, border:"1px solid #333", overflow:"hidden" }}>
              <div style={{ background:"#000", borderBottom:"2px solid #5CCC6C", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontWeight:900, fontSize:16 }}>📱 Text — {smsModal.customer}</div>
                <button onClick={() => setSmsModal(null)} style={{ background:"transparent", border:"none", color:"#666", fontSize:22, cursor:"pointer" }}>×</button>
              </div>
              <div style={{ padding:20 }}>
                <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                  {[{key:"delivery",label:"📦 Delivery"},{key:"pickup",label:"🚛 Pickup"},{key:"payment",label:"💵 Payment"}].map(t => (
                    <button key={t.key} onClick={() => setSmsType(t.key)} style={{ flex:1, background:smsType===t.key?"#5CCC6C":"#2A2A2A", color:smsType===t.key?"#000":"#888", border:"none", borderRadius:8, padding:"8px 6px", fontWeight:700, fontSize:12, cursor:"pointer" }}>{t.label}</button>
                  ))}
                </div>
                <div style={{ background:"#111", borderRadius:10, padding:14, fontSize:14, color:"#CCC", lineHeight:1.6, marginBottom:16, border:"1px solid #222" }}>{msg}</div>
                <div style={{ fontSize:12, color:"#555", marginBottom:16 }}>To: <span style={{ color:"#888" }}>{smsModal.phone}</span></div>
                <a href={`sms:${smsModal.phone}&body=${encodeURIComponent(msg)}`}
                  onClick={() => sendSms(smsModal, smsType, msg)}
                  style={{ display:"block", background:"#5CCC6C", color:"#000", borderRadius:10, padding:"13px", fontWeight:900, fontSize:16, textAlign:"center", textDecoration:"none" }}>
                  Open in Messages →
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ ADD UNIT MODAL ══ */}
      {newDump && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={e => { if (e.target===e.currentTarget) setNewDump(false); }}>
          <div style={{ background:"#1A1A1A", borderRadius:16, width:"100%", maxWidth:420, border:"1px solid #333", overflow:"hidden" }}>
            <div style={{ background:"#000", borderBottom:`2px solid ${ORANGE}`, padding:"16px 20px", display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontWeight:900, fontSize:16 }}>Add New Dumpster Unit</div>
              <button onClick={() => setNewDump(false)} style={{ background:"transparent", border:"none", color:"#666", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
              {[{label:"Size",key:"size",options:DUMPSTER_SIZES},{label:"Condition",key:"condition",options:["Good","Fair","Needs Repair"]}].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <select value={newDump[f.key]} onChange={e => setNewDump({ ...newDump, [f.key]:e.target.value })} style={selectStyle}>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea value={newDump.notes} onChange={e => setNewDump({ ...newDump, notes:e.target.value })} rows={2} style={{ ...inputStyle, resize:"vertical" }} />
              </div>
            </div>
            <div style={{ padding:"0 20px 20px" }}>
              <button onClick={() => addUnit(newDump)} style={{ ...btnPrimary, width:"100%", padding:12, fontSize:15, borderRadius:8 }}>Add Unit</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EDIT UNIT MODAL ══ */}
      {editDump && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={e => { if (e.target===e.currentTarget) setEditDump(null); }}>
          <div style={{ background:"#1A1A1A", borderRadius:16, width:"100%", maxWidth:420, border:"1px solid #333", overflow:"hidden" }}>
            <div style={{ background:"#000", borderBottom:`2px solid ${ORANGE}`, padding:"16px 20px", display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontWeight:900, fontSize:16 }}>Unit {editDump.id}</div>
              <button onClick={() => setEditDump(null)} style={{ background:"transparent", border:"none", color:"#666", fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
              {[
                { label:"Status",    key:"status",    options:["Available","In Transit","On-Site","Maintenance"] },
                { label:"Condition", key:"condition", options:["Good","Fair","Needs Repair"] },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <select value={editDump[f.key]} onChange={e => setEditDump({ ...editDump, [f.key]:e.target.value })} style={selectStyle}>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={editDump.notes} onChange={e => setEditDump({ ...editDump, notes:e.target.value })} rows={2} style={{ ...inputStyle, resize:"vertical" }} />
              </div>
            </div>
            <div style={{ padding:"0 20px 20px" }}>
              <button onClick={() => saveDump(editDump)} style={{ ...btnPrimary, width:"100%", padding:12, fontSize:15, borderRadius:8 }}>Save Unit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


