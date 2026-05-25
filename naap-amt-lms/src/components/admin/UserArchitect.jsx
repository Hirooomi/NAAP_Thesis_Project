import { useState, useEffect } from 'react';

export default function UserArchitect({ pendingApprovals, handleApproveAccount, setPendingApprovals, triggerModal }) {
  // ==========================================
  // RBAC: ROLE-BASED ACCESS CONTROL
  // ==========================================
  const currentAdminRole = localStorage.getItem('role') || 'HEAD_ADMIN'; 
  const currentClearanceLevel = parseInt(localStorage.getItem('adminClearance') || '0', 10); 

  const [architectTab, setArchitectTab] = useState('CREATE'); 
  const [selectedRole, setSelectedRole] = useState('FACULTY');
  
  // Universal Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Admin Specific
  const [adminId, setAdminId] = useState('ADM-' + Math.floor(1000 + Math.random() * 9000));
  const [adminSecurityLevel, setAdminSecurityLevel] = useState('Tier 3: Support Helper');

  // Faculty Specific
  const [facultyId, setFacultyId] = useState('');
  const [prefix, setPrefix] = useState('Sir');
  const [suffix, setSuffix] = useState('');
  const [subjectInput, setSubjectInput] = useState('Powerplant & Propellers');
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  // Student Specific
  const [studentId, setStudentId] = useState('');
  const [studentYear, setStudentYear] = useState('1st Year');
  const [studentSection, setStudentSection] = useState('A');

  // LIVE DATABASE ROSTERS
  const [activeAdmins, setActiveAdmins] = useState([]);
  const [activeProfs, setActiveProfs] = useState([]);
  const [activeStudents, setActiveStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================
  // NEW: AI REJECTION PROTOCOL STATE
  // ==========================================
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [targetRequest, setTargetRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionDraft, setRejectionDraft] = useState('');
  const [isDraftingRejection, setIsDraftingRejection] = useState(false);
  const [isSendingRejection, setIsSendingRejection] = useState(false);

  // FETCH ROSTERS FROM BACKEND
  const fetchRosters = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/users/roster', {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveAdmins(data.admins);
        setActiveProfs(data.profs);
        setActiveStudents(data.students);
      }
    } catch (err) {
      console.error("Failed to fetch rosters:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRosters();
  }, []);

  // ==========================================
  // CORE LOGIC: BULK IMPORT (CSV/EXCEL)
  // ==========================================
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    triggerModal({
        type: 'CONFIRM',
        title: 'Initialize Bulk Import?',
        message: `Parse ${file.name} and whitelist all contained students for secure self-registration?`,
        onYes: async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/users/bulk-import', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (response.ok) {
                    alert("[SYSTEM] Bulk whitelist successfully injected.");
                    fetchRosters();
                } else {
                    alert("Import Failed. Ensure file format is correct.");
                }
            } catch (error) {
                alert("Network error during import sequence.");
            }
        }
    });
    e.target.value = null; 
  };

  // ==========================================
  // CORE LOGIC: CREATION & DEPLOYMENT
  // ==========================================
  const handleDeployAccount = async () => {
    if (!firstName || !lastName || !email) {
      triggerModal({ type: 'WARNING', title: 'Data Missing', message: 'ERROR: First Name, Last Name, and Email are mandatory fields for database entry.' });
      return;
    }

    if (selectedRole === 'STUDENT' && !studentId) {
        triggerModal({ type: 'WARNING', title: 'ID Missing', message: 'ERROR: Please enter a valid Student ID.' });
        return;
    }
    if (selectedRole === 'FACULTY' && !facultyId) {
        triggerModal({ type: 'WARNING', title: 'ID Missing', message: 'ERROR: Please enter a valid Faculty ID.' });
        return;
    }

    const payload = {
        role: selectedRole,
        first_name: firstName,
        last_name: lastName,
        email: email,
        user_id: selectedRole === 'ADMIN' ? adminId : (selectedRole === 'STUDENT' ? studentId : facultyId),
        admin_clearance: selectedRole === 'ADMIN' ? adminSecurityLevel : null,
        honorific: selectedRole === 'FACULTY' ? prefix : null,
        suffix: selectedRole === 'FACULTY' ? suffix : null,
        subjects: selectedRole === 'FACULTY' ? selectedSubjects.join(', ') : null,
        year_level: selectedRole === 'STUDENT' ? studentYear : null,
        section: selectedRole === 'STUDENT' ? studentSection : null,
        requester_id: localStorage.getItem('userId') || 'SYSTEM'
    };

    const isRestrictedAction = currentClearanceLevel === 3 || (currentClearanceLevel === 2 && selectedRole === 'ADMIN');

    if (isRestrictedAction) {
       triggerModal({
           type: 'CONFIRM',
           title: 'Submit Creation Request?',
           message: `Your clearance (Level ${currentClearanceLevel}) does not permit direct provisioning of ${selectedRole} accounts. Submit this request to a higher-tier admin for approval?`,
           onYes: async () => {
               try {
                   await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/users/request-create', {
                       method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                   });
                   alert(`[SYSTEM] Request placed in the Maker-Checker queue.`);
                   setFirstName(''); setLastName(''); setEmail(''); setSuffix(''); setStudentId(''); setFacultyId(''); setSelectedSubjects([]);
               } catch (e) { alert("Failed to submit request."); }
           }
       });
       return;
    }
    
    triggerModal({
        type: 'CONFIRM',
        title: 'Verify Account Provisioning?',
        message: `Deploying new ${selectedRole} account for ${firstName} ${lastName}? Temporary credentials will be generated and dispatched to ${email}.`,
        onYes: async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/users/create', {
                    method: 'POST', 
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    }, 
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if(response.ok) {
                    alert(`[SYSTEM] Account provisioned. SMTP Email dispatched with temporary password.`);
                    setFirstName(''); setLastName(''); setEmail(''); setSuffix(''); setStudentId(''); setFacultyId(''); setSelectedSubjects([]);
                    fetchRosters();
                } else {
                    alert(`Error: ${result.detail}`);
                }
            } catch (e) { alert("Deployment Failed."); }
        }
    });
  };

  const addSubject = () => {
    if(subjectInput && !selectedSubjects.includes(subjectInput)) {
      setSelectedSubjects([...selectedSubjects, subjectInput]);
    }
  };

  const removeSubject = (sub) => {
    setSelectedSubjects(selectedSubjects.filter(s => s !== sub));
  };

  const initiateTermination = (entity, type) => {
    const isRestrictedAction = currentClearanceLevel === 3 || (currentClearanceLevel === 2 && type === 'Admin');

    if (isRestrictedAction) {
       triggerModal({
           type: 'CONFIRM',
           title: `Request ${type} Purge?`,
           message: `Your clearance (Level ${currentClearanceLevel}) requires authorization to purge a ${type}. Send purge request to superior admins?`,
           reasonRequired: true,
           targetId: entity.id,
           onYes: async () => {
               alert(`[SYSTEM] Purge Request placed in queue.`);
           }
       });
       return;
    }

    triggerModal({
        type: 'PURGE_BACKUP',
        title: `Purge ${type} Roster Entry?`,
        message: `Initialize database purge for ${entity.name} (${entity.id})? Active quiz attempts will be halted. Raw data backup must be generated before deletion.`,
        reasonRequired: true,
        targetId: entity.id,
        onYes: async () => {
            try {
                const token = localStorage.getItem('token');
                await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/users/purge/${entity.id}`, { 
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                alert(`Backup stored securely. Live data Purged.`);
                fetchRosters();
            } catch (e) { alert("Failed to purge entity."); }
        }
    });
  };

  // ==========================================
  // NEW: AI REJECTION PROTOCOL EXECUTION
  // ==========================================
  const openRejectionModal = (request) => {
      setTargetRequest(request);
      setRejectionReason('');
      setRejectionDraft('');
      setRejectionModalOpen(true);
  };

  const handleDraftRejection = async () => {
      setIsDraftingRejection(true);
      try {
          const token = localStorage.getItem('token');
          const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/users/draft-rejection', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ student_name: targetRequest.name, reason: rejectionReason })
          });
          const data = await res.json();
          if(res.ok) {
              setRejectionDraft(data.draft);
          } else {
              alert("Failed to connect to AI Engine.");
          }
      } catch(e) { 
          alert("Network error."); 
      } finally {
          setIsDraftingRejection(false);
      }
  };

  const handleFinalizeRejection = async () => {
      setIsSendingRejection(true);
      try {
          const token = localStorage.getItem('token');
          const res = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/users/finalize-rejection/${targetRequest.id}`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ student_email: targetRequest.email, email_body: rejectionDraft })
          });
          
          if(res.ok) {
              alert("[SYSTEM] Rejection letter dispatched and database purged.");
              setPendingApprovals(prev => prev.filter(r => r.id !== targetRequest.id));
              setRejectionModalOpen(false);
          } else {
              alert("Failed to dispatch rejection.");
          }
      } catch(e) { 
          alert("Network error."); 
      } finally {
          setIsSendingRejection(false);
      }
  };

  return (
    <div className="animate-fade-in max-w-[100rem] mx-auto relative">
      
      {/* ========================================== */}
      {/* NEW: AI REJECTION PROTOCOL MODAL OVERLAY */}
      {/* ========================================== */}
      {rejectionModalOpen && targetRequest && (
        <div className="fixed inset-0 bg-red-950/90 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-950 border-2 border-red-600 rounded-3xl max-w-2xl w-full p-8 md:p-10 shadow-[0_0_50px_rgba(220,38,38,0.3)] flex flex-col relative">
                <button onClick={() => setRejectionModalOpen(false)} className="absolute top-4 right-6 text-slate-500 hover:text-white font-black text-2xl transition-colors">✕</button>

                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest mb-2 flex items-center gap-3"><span className="text-red-500">🤖</span> AI Rejection Protocol</h2>
                <p className="text-xs text-slate-400 mb-6 font-mono leading-relaxed border-b border-slate-800 pb-4">
                    Target Identity: <strong className="text-white">{targetRequest.name}</strong><br/>
                    Target Email: <strong className="text-amber-500">{targetRequest.email}</strong>
                </p>

                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Reason for Rejection</label>
                        <input type="text" value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)} placeholder="e.g. ID not found in official registry, or suspected duplicate" className="w-full bg-slate-900 border border-slate-700 text-white text-sm font-bold p-4 rounded-xl outline-none focus:border-red-500 transition-colors shadow-inner" />
                    </div>

                    <button onClick={handleDraftRejection} disabled={isDraftingRejection || !rejectionReason.trim()} className="w-full bg-red-900/20 hover:bg-red-900/50 text-red-400 border border-red-500/50 font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isDraftingRejection ? 'Synthesizing Draft...' : 'Draft Formal Rejection Letter'}
                    </button>

                    {rejectionDraft && (
                        <div className="animate-fade-in space-y-4 pt-6 border-t border-slate-800">
                            <div>
                                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Review & Edit AI Draft</label>
                                <textarea value={rejectionDraft} onChange={e=>setRejectionDraft(e.target.value)} rows="8" className="w-full bg-slate-900 border border-blue-900/50 text-white text-sm p-4 rounded-xl outline-none focus:border-red-500 custom-scrollbar resize-none shadow-inner"></textarea>
                            </div>
                            <button onClick={handleFinalizeRejection} disabled={isSendingRejection || !rejectionDraft.trim()} className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-xl uppercase tracking-[0.2em] text-xs transition-colors shadow-lg shadow-red-900/20 active:scale-95">
                                {isSendingRejection ? 'Processing...' : 'Confirm Rejection & Dispatch Email'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}


      {/* TOP NAVIGATION */}
      <div className="flex bg-slate-950 rounded-xl border border-slate-800 p-2 mb-8 w-max">
        {['CREATE', 'ROSTER_ADMIN', 'ROSTER_PROF', 'ROSTER_STUDENT'].map(tab => (
          (tab === 'ROSTER_ADMIN' && currentClearanceLevel === 3) ? null : (
            <button key={tab} onClick={() => setArchitectTab(tab)} className={`text-[10px] font-black px-6 py-3 rounded-lg uppercase tracking-widest transition-colors ${architectTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{tab.replace('_', ' ')}</button>
          )
        ))}
      </div>

      {architectTab === 'CREATE' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          <div className="flex flex-col gap-8">
              {/* THE CREATOR FORM */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl shrink-0">
                <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Account Architect</h3>
                <div className="space-y-6">
                  
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex justify-between">
                      <span>Entity Tier</span>
                      {currentClearanceLevel === 2 && selectedRole === 'ADMIN' && <span className="text-amber-500">Requires L1 Approval</span>}
                      {currentClearanceLevel === 3 && <span className="text-amber-500">Requires Approval</span>}
                    </label>
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full bg-slate-900 border border-blue-900/50 text-blue-400 text-xs font-bold p-4 rounded-xl outline-none focus:border-blue-500 cursor-pointer uppercase tracking-widest">
                      <option value="FACULTY">Faculty / Professor (Tier 2)</option>
                      <option value="STUDENT">Student (Tier 3)</option>
                      {currentClearanceLevel <= 2 && <option value="ADMIN">Sub-Admin (Tier 1)</option>}
                    </select>
                  </div>

                  {/* DYNAMIC ADMIN FIELDS */}
                  {selectedRole === 'ADMIN' && (
                    <div className="space-y-4 bg-slate-900 border border-slate-700 p-5 rounded-xl">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Admin Code / ID</label>
                          <input type="text" value={adminId} onChange={e=>setAdminId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-slate-400 font-mono text-xs p-3 rounded-lg outline-none" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Security Clearance</label>
                          <select value={adminSecurityLevel} onChange={e=>setAdminSecurityLevel(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer">
                            <option value="Tier 1: Full Access">Level 1 (Bypass Tier 2)</option>
                            <option value="Tier 2: Managerial">Level 2 (Managerial / Bypass Tier 3)</option>
                            <option value="Tier 3: Support Helper">Level 3 (Helper / Drafts Only)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-3 block">Functional Roles (Select Multiple)</label>
                        <div className="space-y-2 grid grid-cols-2">
                          <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-amber-500" /> Data Vault Manager</label>
                          <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-amber-500" /> Support / Triage Agent</label>
                          <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-amber-500" /> Global Communications</label>
                          <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-amber-500" /> Core UI Developer</label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC FACULTY FIELDS */}
                  {selectedRole === 'FACULTY' && (
                    <div className="space-y-4 bg-slate-900 border border-slate-700 p-5 rounded-xl">
                      <div>
                         <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Faculty ID Number</label>
                         <input type="text" value={facultyId} onChange={e=>setFacultyId(e.target.value)} placeholder="e.g. FAC-2026-001" className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs p-3 rounded-lg outline-none focus:border-emerald-500 transition-colors" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Prefix</label>
                          <select value={prefix} onChange={e=>setPrefix(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer">
                            <option>Sir</option><option>Ma'am</option><option>Prof.</option><option>Dr.</option><option>None</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Suffix / Additional Title</label>
                          <input type="text" value={suffix} onChange={e=>setSuffix(e.target.value)} placeholder="e.g. MEAM, PhD, MSc" className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Assign RAG Categories</label>
                        <div className="flex gap-2 mb-2">
                          <select value={subjectInput} onChange={e=>setSubjectInput(e.target.value)} className="flex-grow bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer">
                            <option>Powerplant & Propellers</option>
                            <option>Airframe Structures</option>
                            <option>Aviation Legislation</option>
                            <option>Aerodynamics</option>
                            <option>Aviation Mathematics & Physics</option>
                            <option>Aircraft Materials & Hardware</option>
                            <option>Avionics & Electrical Systems</option>
                          </select>
                          <button onClick={addSubject} className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/50 px-4 rounded-lg font-black text-xs hover:bg-emerald-600 hover:text-white transition-colors">+</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedSubjects.map(sub => (
                            <span key={sub} className="text-[9px] font-black uppercase bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                              {sub} <button onClick={()=>removeSubject(sub)} className="text-emerald-200 hover:text-red-500">✕</button>
                            </span>
                          ))}
                          {selectedSubjects.length === 0 && <span className="text-[9px] text-slate-500 uppercase tracking-widest">No categories assigned.</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC STUDENT FIELDS */}
                  {selectedRole === 'STUDENT' && (
                    <div className="space-y-4 bg-slate-900 border border-slate-700 p-5 rounded-xl">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Student ID Number</label>
                          <input type="text" value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="e.g. 12324MN-000" className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs p-3 rounded-lg outline-none" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Year Level</label>
                          <select value={studentYear} onChange={e=>setStudentYear(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer">
                            <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Section</label>
                          <input type="text" value={studentSection} onChange={e=>setStudentSection(e.target.value)} placeholder="e.g. A, B, C" className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none uppercase" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UNIVERSAL USER FIELDS */}
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">First Name</label><input type="text" value={firstName} onChange={e=>setFirstName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-bold p-3 rounded-xl outline-none focus:border-blue-500" /></div>
                    <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Last Name</label><input type="text" value={lastName} onChange={e=>setLastName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-bold p-3 rounded-xl outline-none focus:border-blue-500" /></div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">System Registered Email</label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@student.edu.ph" className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-xs p-3 rounded-xl outline-none focus:border-blue-500" />
                  </div>

                  {/* RBAC DYNAMIC BUTTON */}
                  <button 
                    onClick={handleDeployAccount} 
                    className={`w-full font-black py-5 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-xl active:scale-95 ${
                      currentClearanceLevel === 3 || (currentClearanceLevel === 2 && selectedRole === 'ADMIN')
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/50' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white' 
                    }`}
                  >
                    {currentClearanceLevel === 3 || (currentClearanceLevel === 2 && selectedRole === 'ADMIN')
                      ? `Submit ${selectedRole} Creation Request`
                      : 'Deploy Account & Sync Email'
                    }
                  </button>
                </div>
              </div>

              {/* BULK IMPORT SECTION */}
              {currentClearanceLevel <= 1 && (
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl shrink-0">
                  <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 border-b border-slate-800 pb-4 flex items-center gap-3">
                    <span className="text-emerald-500">📁</span> Bulk Whitelist Import
                  </h3>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">Upload a CSV or Excel file containing Student IDs, First Names, and Last Names to pre-approve them for secure self-registration via the public portal.</p>
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-emerald-900/20 file:text-emerald-400 hover:file:bg-emerald-900/40 transition-colors cursor-pointer border border-slate-800 rounded-xl bg-slate-900 p-2"
                  />
                </div>
              )}
          </div>

          {/* ========================================== */}
          {/* MAKER CHECKER QUEUE (WITH AI REJECT BUTTONS) */}
          {/* ========================================== */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col h-full min-h-[500px]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 shrink-0">
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Maker-Checker Queue</h3>
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-900/20 px-3 py-1 rounded border border-red-900/50">{pendingApprovals.length} Pending</span>
            </div>
            
            <div className="flex-grow space-y-4 overflow-y-auto custom-scrollbar pr-2">
              {pendingApprovals.map(req => (
                <div key={req.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl relative">
                  
                  {/* NEW: Explicit X button in top right for Rejection Protocol */}
                  <button onClick={() => openRejectionModal(req)} className="absolute top-4 right-5 text-slate-500 hover:text-red-500 font-bold transition-colors">✕</button>

                  <div className="flex justify-between items-start mb-4">
                    <div className="pr-6">
                      <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1 border border-amber-900/50 bg-amber-900/20 px-2 py-0.5 w-max rounded">{req.type}</span>
                      <span className="text-sm font-bold text-white block">{req.name} <span className="text-slate-500 text-xs">({req.spec})</span></span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1 hidden md:block">Req By: {req.requestedBy}</span>
                  </div>
                  
                  {currentClearanceLevel <= 1 || (currentClearanceLevel === 2 && req.type !== 'NEW_SUB_ADMIN') ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveAccount(req.id, req.name)} className="flex-[2] bg-emerald-900/30 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 font-black py-2 rounded-lg uppercase tracking-widest text-[9px] transition-colors">Verify & Activate</button>
                      <button onClick={() => openRejectionModal(req)} className="flex-1 bg-red-900/10 hover:bg-red-900/50 text-red-500 border border-red-900/50 hover:border-red-500/50 font-black py-2 rounded-lg uppercase tracking-widest text-[9px] transition-colors">AI Reject Protocol</button>
                    </div>
                  ) : (
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Requires L1 Authorization</p>
                  )}
                </div>
              ))}
              {pendingApprovals.length === 0 && (
                <div className="text-center py-10 opacity-50">
                   <span className="text-3xl block mb-2">📋</span>
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Queue is empty.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ROSTER_ADMIN */}
      {architectTab === 'ROSTER_ADMIN' && !isLoading && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Active Sub-Admin Roster</h3>
          <div className="grid gap-4">
            {activeAdmins.map(admin => (
              <div key={admin.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex justify-between items-center group relative">
                <div>
                  <h4 className="text-white font-bold text-lg">{admin.name} <span className="text-amber-500 text-sm ml-2 font-mono">[{admin.id}]</span></h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-1 mb-3">{admin.email}</p>
                  <div className="flex gap-2 items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-amber-900/20 text-amber-500 border border-amber-900/50 px-2 py-1 rounded">{admin.level}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => initiateTermination(admin, 'Admin')} 
                    className={`text-[9px] font-black px-4 py-2 rounded tracking-widest transition-colors ${currentClearanceLevel === 0 ? 'bg-slate-800 text-red-500 hover:bg-red-600 hover:text-white uppercase' : 'bg-slate-800/50 text-amber-500/50 cursor-not-allowed uppercase line-through'}`}
                    disabled={currentClearanceLevel > 0}
                  >
                    {currentClearanceLevel === 0 ? '✕ Revoke Access' : 'T0 Clearance Required'}
                  </button>
                </div>
              </div>
            ))}
            {activeAdmins.length === 0 && <p className="text-slate-500 text-xs">No admins found.</p>}
          </div>
        </div>
      )}

      {/* ROSTER_PROF */}
      {architectTab === 'ROSTER_PROF' && !isLoading && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Active Faculty Roster</h3>
          <div className="grid gap-4">
            {activeProfs.map(prof => (
              <div key={prof.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex justify-between items-center group relative">
                <div>
                  <h4 className="text-white font-bold text-lg">{prof.honorific} {prof.name}, <span className="text-emerald-400 text-sm">{prof.suffix}</span> <span className="text-xs text-slate-500 font-mono ml-2">[{prof.id}]</span></h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-1 mb-3">{prof.email}</p>
                  <div className="flex flex-wrap gap-2">
                    {prof.subjects && prof.subjects.split(',').map(sub => <span key={sub} className="text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-400 px-2 py-1 rounded">{sub.trim()}</span>)}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => initiateTermination(prof, 'Faculty')} 
                    className={`text-[9px] font-black px-4 py-2 rounded tracking-widest transition-colors uppercase ${currentClearanceLevel === 3 ? 'bg-amber-900/30 text-amber-500 hover:bg-amber-600 hover:text-white border border-amber-500/50' : 'bg-slate-800 text-red-500 hover:bg-red-600 hover:text-white'}`}
                  >
                    {currentClearanceLevel === 3 ? 'Req Purge' : '✕ Terminate'}
                  </button>
                </div>
              </div>
            ))}
            {activeProfs.length === 0 && <p className="text-slate-500 text-xs">No faculty found.</p>}
          </div>
        </div>
      )}

      {/* ROSTER_STUDENT */}
      {architectTab === 'ROSTER_STUDENT' && !isLoading && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Active Student Roster</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 border-b border-slate-800">
                <tr><th className="pb-4 pl-2">Student Info</th><th className="pb-4">Yr & Sec</th><th className="pb-4">Login Detail</th><th className="pb-4 text-right pr-2">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {activeStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-900 transition-colors">
                    <td className="py-4 pl-2">
                      <span className="text-sm text-white font-bold block mb-1">{student.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono block">{student.id}</span>
                    </td>
                    <td className="py-4 text-slate-300 font-black text-xs">{student.year} - {student.section}</td>
                    <td className="py-4">
                      <span className="block text-[10px] text-blue-400 font-mono mb-1">{student.email}</span>
                    </td>
                    <td className="py-4 text-right pr-2 flex justify-end gap-2 items-center">
                       <button onClick={() => { triggerModal({ type: 'CONFIRM', title: 'Resend Passcode?', message: `Dispatch new temporary credentials via SMTP to ${student.email}?`, onYes: () => alert(`Email Dispatched to ${student.email}.` ) })}} className="text-[9px] font-black px-3 py-1.5 rounded border border-slate-700 text-blue-400 hover:bg-slate-800 uppercase tracking-widest">Resend Pass</button>
                       <button 
                         onClick={() => initiateTermination(student, 'Student')} 
                         className={`text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest transition-colors ${currentClearanceLevel === 3 ? 'border border-amber-900/50 bg-amber-900/20 text-amber-500 hover:bg-amber-600 hover:text-white' : 'border border-red-900/50 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white'}`}
                       >
                         {currentClearanceLevel === 3 ? 'Req Expel' : '✕ Expel'}
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeStudents.length === 0 && <p className="text-slate-500 text-xs mt-4">No students found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}