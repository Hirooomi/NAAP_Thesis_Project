import { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../apiConfig";

export default function AccountCreator({ currentClearanceLevel, triggerModal, fetchRosters, activeStudents, activeAdmins }) {
  const [selectedRole, setSelectedRole] = useState('FACULTY');
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const [adminId, setAdminId] = useState('ADM-1000');
  const [adminSecurityLevel, setAdminSecurityLevel] = useState('Tier 3: Support Helper');

  const [facultyId, setFacultyId] = useState('');
  const [prefix, setPrefix] = useState('Sir');
  const [suffix, setSuffix] = useState('');
  const [subjectInput, setSubjectInput] = useState('Powerplant & Propellers');
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  const [studentId, setStudentId] = useState('');
  const [studentYear, setStudentYear] = useState('1st Year');
  const [studentSection, setStudentSection] = useState('1');

  const [employmentStatus, setEmploymentStatus] = useState('Unemployed');
  const [companyName, setCompanyName] = useState('');
  const [alumniBatch, setAlumniBatch] = useState('2024'); // Default to year
  const [alumniDegree, setAlumniDegree] = useState('BSAMT');

  const [testerId, setTesterId] = useState('TST-1000');
  const [testerBirthday, setTesterBirthday] = useState('');
  const [testerInstitute, setTesterInstitute] = useState('');
  const [testerPhone, setTesterPhone] = useState('');
  const [testerGender, setTesterGender] = useState('Male');
  const [validityStart, setValidityStart] = useState('');
  const [validityEnd, setValidityEnd] = useState('');

  const sectionsList = Array.from({length: 10}, (_, i) => (i + 1).toString());
  
  // Dynamic list of years from 2000 to current year for Alumni Batch
  const currentYear = new Date().getFullYear();
  const yearList = Array.from({length: currentYear - 2000 + 1}, (_, i) => (currentYear - i).toString());

  useEffect(() => {
    const tCount = (activeStudents || []).filter(s => s.id && s.id.startsWith('TST')).length;
    setTesterId(`TST-${1000 + tCount}`);
    
    const aCount = (activeAdmins || []).length;
    setAdminId(`ADM-${1000 + aCount}`);
  }, [activeStudents, activeAdmins]);

  const addSubject = () => {
    if(subjectInput && !selectedSubjects.includes(subjectInput)) setSelectedSubjects([...selectedSubjects, subjectInput]);
  };

  const removeSubject = (sub) => setSelectedSubjects(selectedSubjects.filter(s => s !== sub));

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
                const token = sessionStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}api/users/bulk-import`, {
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

  const handleDeployAccount = async () => {
    if (!firstName || !lastName || !email) {
      triggerModal({ type: 'WARNING', title: 'Data Missing', message: 'First Name, Last Name, and Email are mandatory.' });
      return;
    }

    if ((selectedRole === 'STUDENT' || selectedRole === 'ALUMNI') && !studentId) {
        triggerModal({ type: 'WARNING', title: 'ID Missing', message: 'ERROR: Please enter a valid ID.' });
        return;
    }
    if (selectedRole === 'FACULTY' && !facultyId) {
        triggerModal({ type: 'WARNING', title: 'ID Missing', message: 'ERROR: Please enter a valid Faculty ID.' });
        return;
    }

    let finalSuffix = selectedRole === 'FACULTY' ? suffix : null;
    let finalSubjects = selectedRole === 'FACULTY' ? selectedSubjects.join(', ') : null;
    let finalSection = (selectedRole === 'STUDENT' || selectedRole === 'ALUMNI') ? studentSection : null;
    let finalYear = selectedRole === 'STUDENT' ? studentYear : null;

    if (selectedRole === 'ALUMNI') {
        finalSuffix = JSON.stringify({ employment: employmentStatus, company: companyName, degree: alumniDegree });
        finalSubjects = `Batch ${alumniBatch}`; // Prepend "Batch " before sending to DB
        finalYear = "Alumni";
    } else if (selectedRole === 'TESTER') {
        finalSuffix = JSON.stringify({ phone: testerPhone, institute: testerInstitute, gender: testerGender, start: validityStart, end: validityEnd, birthday: testerBirthday });
        finalSection = "Beta";
        finalYear = "Tester";
    }

    const payload = {
        role: selectedRole,
        first_name: firstName,
        last_name: lastName,
        email: email,
        user_id: selectedRole === 'ADMIN' ? adminId : (selectedRole === 'FACULTY' ? facultyId : selectedRole === 'TESTER' ? testerId : studentId),
        admin_clearance: selectedRole === 'ADMIN' ? adminSecurityLevel : null,
        honorific: selectedRole === 'FACULTY' ? prefix : null,
        suffix: finalSuffix,
        subjects: finalSubjects,
        year_level: finalYear,
        section: finalSection,
        requester_id: sessionStorage.getItem('userId') || 'SYSTEM'
    };

    const isRestrictedAction = currentClearanceLevel === 3 || (currentClearanceLevel === 2 && selectedRole === 'ADMIN');

    if (isRestrictedAction) {
       triggerModal({
           type: 'CONFIRM',
           title: 'Submit Creation Request?',
           message: `Your clearance does not permit direct provisioning of ${selectedRole} accounts. Submit this request to a higher-tier admin for approval?`,
           onYes: async () => {
               try {
                   const token = sessionStorage.getItem('token');
                   await fetch(`${API_BASE_URL}api/users/request-create`, {
                       method: 'POST', 
                       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                       body: JSON.stringify(payload)
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
        message: `Deploying new ${selectedRole} account for ${firstName} ${lastName}? Credentials will be dispatched via SMTP.`,
        onYes: async () => {
            try {
                const token = sessionStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}api/users/create`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if(response.ok) {
                    alert(`[SYSTEM] Account provisioned successfully.`);
                    setFirstName(''); setLastName(''); setEmail('');
                    fetchRosters();
                } else alert(`Error: ${result.detail}`);
            } catch (e) { alert("Deployment Failed."); }
        }
    });
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shrink-0">
        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Account Architect</h3>
        <div className="space-y-6">
          
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex justify-between">
              <span>Entity Tier</span>
            </label>
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full bg-slate-900 border border-blue-900/50 text-white text-xs p-4 rounded-xl outline-none focus:border-blue-500 cursor-pointer uppercase tracking-widest">
              <option value="FACULTY">Faculty / Professor (Tier 2)</option>
              <option value="STUDENT">Student (Tier 3)</option>
              <option value="ALUMNI">Alumni / Evaluator (Tier 3)</option>
              <option value="TESTER">Tester Panel</option>
              {currentClearanceLevel <= 2 && <option value="ADMIN">Sub-Admin (Tier 1)</option>}
            </select>
          </div>

          {selectedRole === 'ADMIN' && (
            <div className="space-y-4 bg-slate-900 border border-slate-700 p-4 md:p-5 rounded-xl animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Admin Code / ID</label>
                  <input type="text" value={adminId} onChange={e=>setAdminId(e.target.value)} className="w-full bg-slate-950 border border-amber-900/50 text-amber-400 font-mono font-bold text-xs p-3 rounded-lg outline-none focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Security Clearance</label>
                  <select value={adminSecurityLevel} onChange={e=>setAdminSecurityLevel(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-amber-500 transition-colors">
                    <option value="Tier 1: Full Access">Level 1 (Bypass Tier 2)</option>
                    <option value="Tier 2: Managerial">Level 2 (Managerial / Bypass Tier 3)</option>
                    <option value="Tier 3: Support Helper">Level 3 (Helper / Drafts Only)</option>
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-3 block">Functional Roles (Select Multiple)</label>
                <div className="space-y-3 md:space-y-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-amber-500" /> Data Vault Manager</label>
                  <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-amber-500" /> Support / Triage Agent</label>
                  <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-amber-500" /> Global Communications</label>
                  <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-amber-500" /> Core UI Developer</label>
                </div>
              </div>
            </div>
          )}

          {selectedRole === 'FACULTY' && (
            <div className="space-y-4 bg-slate-900 border border-slate-700 p-4 md:p-5 rounded-xl animate-fade-in">
              <div>
                 <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Faculty ID Number</label>
                 <input type="text" value={facultyId} onChange={e=>setFacultyId(e.target.value)} placeholder="e.g. FAC-2026-001" className="w-full bg-slate-950 border border-emerald-900/50 text-emerald-400 font-mono font-bold text-xs p-3 rounded-lg outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Prefix</label>
                  <select value={prefix} onChange={e=>setPrefix(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-emerald-500 transition-colors">
                    <option>Sir</option><option>Ma'am</option><option>Prof.</option><option>Dr.</option><option>None</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Suffix / Additional Title</label>
                  <input type="text" value={suffix} onChange={e=>setSuffix(e.target.value)} placeholder="e.g. MEAM, PhD, MSc" className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none focus:border-emerald-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Assign RAG Categories</label>
                <div className="flex gap-2 mb-2">
                  <select value={subjectInput} onChange={e=>setSubjectInput(e.target.value)} className="flex-grow bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-emerald-500 transition-colors">
                    <option>Powerplant & Propellers</option><option>Airframe Structures</option><option>Aviation Legislation</option><option>Aerodynamics</option><option>Aviation Mathematics & Physics</option><option>Aircraft Materials & Hardware</option><option>Avionics & Electrical Systems</option>
                  </select>
                  <button onClick={addSubject} className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/50 px-4 rounded-lg font-black text-xs hover:bg-emerald-600 hover:text-white transition-colors">+</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSubjects.map(sub => (
                    <span key={sub} className="text-[9px] font-black uppercase bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      {sub} <button onClick={()=>removeSubject(sub)} className="text-emerald-200 hover:text-red-500">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedRole === 'STUDENT' && (
            <div className="space-y-4 bg-slate-900 border border-slate-700 p-4 md:p-5 rounded-xl animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Student ID Number</label>
                  <input type="text" value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="e.g. 12324MN-000" className="w-full bg-slate-950 border border-blue-900/50 text-blue-400 font-mono font-bold text-xs p-3 rounded-lg outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Year Level</label>
                  <select value={studentYear} onChange={e=>setStudentYear(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-blue-500 transition-colors">
                    <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Section</label>
                  <select value={studentSection} onChange={e=>setStudentSection(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-blue-500 transition-colors">
                    {sectionsList.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {selectedRole === 'ALUMNI' && (
            <div className="space-y-4 bg-slate-900 border border-slate-700 p-4 md:p-5 rounded-xl animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-2 block">Alumni ID</label>
                  <input type="text" value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="e.g. 12324MN-000" className="w-full bg-slate-950 border border-purple-900/50 text-purple-400 font-mono font-bold text-xs p-3 rounded-lg outline-none focus:border-purple-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-2 block">Graduation Batch Year</label>
                  <select value={alumniBatch} onChange={e=>setAlumniBatch(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-purple-500 transition-colors">
                    {yearList.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-2 block">Employment Status</label>
                  <select value={employmentStatus} onChange={e=>setEmploymentStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-purple-500 transition-colors">
                    <option>Unemployed</option><option>Working at a company</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-2 block">Section Number</label>
                  <select value={studentSection} onChange={e=>setStudentSection(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-purple-500 transition-colors">
                    {sectionsList.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                </div>
                {employmentStatus === 'Working at a company' && (
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-2 block">Company Name (Optional)</label>
                    <input type="text" value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="e.g. Philippine Airlines" className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none focus:border-purple-500 transition-colors" />
                  </div>
                )}
                <div className="col-span-1 md:col-span-2 mt-2">
                  <label className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-3 block">Finished Degree</label>
                  <div className="flex gap-6 bg-slate-950 border border-slate-700 p-4 rounded-lg">
                    <label className="flex items-center gap-3 text-xs font-bold text-white cursor-pointer"><input type="radio" name="deg" checked={alumniDegree==='BSAMT'} onChange={()=>setAlumniDegree('BSAMT')} className="accent-purple-500 w-4 h-4"/> BSAMT</label>
                    <label className="flex items-center gap-3 text-xs font-bold text-white cursor-pointer"><input type="radio" name="deg" checked={alumniDegree==='AAMT'} onChange={()=>setAlumniDegree('AAMT')} className="accent-purple-500 w-4 h-4"/> AAMT</label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedRole === 'TESTER' && (
            <div className="space-y-4 bg-slate-900 border border-slate-700 p-4 md:p-5 rounded-xl animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Tester Code ID</label>
                  <input type="text" value={testerId} onChange={e=>setTesterId(e.target.value)} className="w-full bg-slate-950 border border-amber-900/50 text-amber-400 font-mono font-bold text-xs p-3 rounded-lg outline-none focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Birthday</label>
                  <input type="date" value={testerBirthday} onChange={e=>setTesterBirthday(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 block">School / Institute</label>
                  <input type="text" value={testerInstitute} onChange={e=>setTesterInstitute(e.target.value)} placeholder="e.g. PATTS College" className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Phone Number (Optional)</label>
                  <input type="text" value={testerPhone} onChange={e=>setTesterPhone(e.target.value)} placeholder="+63 9..." className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Gender</label>
                  <select value={testerGender} onChange={e=>setTesterGender(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-amber-500 transition-colors">
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-2 block">Account Creation Date</label>
                    <input type="date" value={validityStart} onChange={e=>setValidityStart(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-red-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-2 block">Account End Date</label>
                    <input type="date" value={validityEnd} onChange={e=>setValidityEnd(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs p-3 rounded-lg outline-none cursor-pointer focus:border-red-500 transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">First Name</label><input type="text" value={firstName} onChange={e=>setFirstName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-3 rounded-xl outline-none focus:border-blue-500" /></div>
            <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Last Name</label><input type="text" value={lastName} onChange={e=>setLastName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-3 rounded-xl outline-none focus:border-blue-500" /></div>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{selectedRole === 'TESTER' ? 'Tester Email (Optional)' : 'System Registered Email'}</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@domain.com" className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-xs p-3 rounded-xl outline-none focus:border-blue-500" />
          </div>

          <button onClick={handleDeployAccount} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-xl active:scale-95">
             Deploy {selectedRole} Account & Sync
          </button>
        </div>
      </div>

      {currentClearanceLevel <= 1 && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shrink-0">
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
  );
}