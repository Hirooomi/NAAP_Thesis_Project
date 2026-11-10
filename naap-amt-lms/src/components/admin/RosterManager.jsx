import { useState } from 'react';
import { API_BASE_URL } from "../../apiConfig";

export default function RosterManager({ 
    architectTab, 
    activeAdmins, 
    activeProfs, 
    activeStudents, 
    isLoading, 
    currentClearanceLevel, 
    triggerModal, 
    fetchRosters 
}) {
  const [editingEntity, setEditingEntity] = useState(null);
  const [editValue, setEditValue] = useState('');

  const sectionsList = Array.from({length: 10}, (_, i) => (i + 1).toString());

  const initiateTermination = (entity, type) => {
    triggerModal({
        type: 'PURGE_BACKUP',
        title: `Purge ${type} Roster Entry?`,
        message: `Initialize database purge for ${entity.name} (${entity.id})? Active quiz attempts will be halted. Raw data backup must be generated before deletion.`,
        reasonRequired: true,
        targetId: entity.id,
        onYes: async (reasonText) => { 
            try {
                const token = sessionStorage.getItem('token');
                const adminId = sessionStorage.getItem('userId') || 'SYSTEM';
                const queryParams = `?admin_id=${adminId}&reason=${encodeURIComponent(reasonText)}`;
                
                const response = await fetch(`${API_BASE_URL}api/users/purge/${entity.id}${queryParams}`, { 
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                     fetchRosters();
                     setTimeout(() => alert(`Backup stored securely. Live data Purged.`), 100);
                } else {
                     setTimeout(() => alert("Failed to purge entity. Check server logs."), 100);
                }
            } catch (e) { 
                setTimeout(() => alert("Failed to purge entity due to network error."), 100); 
            }
        }
    });
  };

  const handleBatchPromote = async () => {
      triggerModal({
          type: 'CONFIRM',
          title: 'Batch Promote Academic Year?',
          message: 'This will irreversibly advance ALL active students up by 1 year level. 4th Year students will be migrated to the Alumni Evaluator tier.',
          onYes: async () => {
              try {
                  const token = sessionStorage.getItem('token');
                  const res = await fetch(`${API_BASE_URL}api/users/batch-promote`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (res.ok) {
                      alert("Batch Promotion Complete.");
                      fetchRosters();
                  } else {
                      const errData = await res.json();
                      alert(`Backend Error: ${errData.detail}`);
                  }
              } catch (e) { alert("Network Error during batch promotion."); }
          }
      });
  };

  const handleInlineSave = async (userId, type) => {
      try {
          const token = sessionStorage.getItem('token');
          // THE FIX: Removed the leading slash to prevent double-slashes and 404 errors with API_BASE_URL
          const endpoint = type === 'SECTION' ? `api/users/${userId}/section` : `api/users/${userId}/subjects`;
          const payload = type === 'SECTION' ? { section: editValue } : { subjects: editValue };

          const res = await fetch(`${API_BASE_URL}${endpoint}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify(payload)
          });

          if (res.ok) {
              fetchRosters();
              setEditingEntity(null);
          } else {
              const errData = await res.json();
              alert(`Update Failed: ${errData.detail}`);
          }
      } catch (e) { alert("Network Error."); }
  };

  if (isLoading) return <p className="text-center text-slate-500 text-xs tracking-widest mt-10">LOADING ROSTERS...</p>;

  return (
    <>
      {/* ROSTER_ADMIN */}
      {architectTab === 'ROSTER_ADMIN' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
          <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Active Sub-Admin Roster</h3>
          <div className="grid gap-4">
            {(activeAdmins || []).map(admin => (
              <div key={admin.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center group relative gap-4">
                <div>
                  <h4 className="text-white font-bold text-lg">{admin.name} <span className="text-amber-500 text-sm ml-2 font-mono">[{admin.id}]</span></h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-1 mb-3">{admin.email}</p>
                  <div className="flex gap-2 items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-amber-900/20 text-amber-500 border border-amber-900/50 px-2 py-1 rounded">{admin.level}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
                  <button 
                    onClick={() => initiateTermination(admin, 'Admin')} 
                    className={`text-[9px] font-black px-4 py-3 md:py-2 rounded tracking-widest transition-colors ${currentClearanceLevel === 0 ? 'bg-slate-800 text-red-500 hover:bg-red-600 hover:text-white uppercase' : 'bg-slate-800/50 text-amber-500/50 cursor-not-allowed uppercase line-through'}`}
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
      {architectTab === 'ROSTER_PROF' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl w-full overflow-x-auto">
          <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Active Faculty Roster</h3>
          <div className="grid gap-4 min-w-[600px]">
            {(activeProfs || []).map(prof => (
              <div key={prof.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex justify-between items-center group relative">
                <div className="flex-1">
                  <h4 className="text-white font-bold text-lg">{prof.honorific} {prof.name}, <span className="text-emerald-400 text-sm">{prof.suffix}</span> <span className="text-xs text-slate-500 font-mono ml-2">[{prof.id}]</span></h4>
                  
                  {editingEntity === prof.id ? (
                    <div className="mt-2 flex gap-2 w-full max-w-md items-center">
                        <select 
                          value={editValue} 
                          onChange={e => setEditValue(e.target.value)} 
                          className="flex-grow bg-slate-950 border border-emerald-500 text-emerald-400 font-bold text-xs p-2 rounded outline-none cursor-pointer"
                        >
                            <option value="" disabled>-- Select Assigned Subject --</option>
                            <option value="Powerplant & Propellers">Powerplant & Propellers</option>
                            <option value="Airframe Structures">Airframe Structures</option>
                            <option value="Aviation Legislation">Aviation Legislation</option>
                            <option value="Aerodynamics">Aerodynamics</option>
                            <option value="Aviation Mathematics & Physics">Aviation Mathematics & Physics</option>
                            <option value="Aircraft Materials & Hardware">Aircraft Materials & Hardware</option>
                            <option value="Avionics & Electrical Systems">Avionics & Electrical Systems</option>
                        </select>
                        <button onClick={() => handleInlineSave(prof.id, 'SUBJECTS')} className="bg-blue-600 hover:bg-blue-500 transition-colors text-white px-4 py-2 rounded text-xs font-bold">Save</button>
                        <button onClick={() => setEditingEntity(null)} className="bg-slate-800 hover:bg-slate-700 transition-colors text-white px-3 py-2 rounded text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex flex-wrap gap-2">
                          {prof.subjects && prof.subjects.split(',').map(sub => <span key={sub} className="text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-400 px-2 py-1 rounded">{sub.trim()}</span>)}
                        </div>
                        <button onClick={() => { setEditingEntity(prof.id); setEditValue(prof.subjects || ''); }} className="text-[9px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-widest">Edit Subjects</button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0 ml-4">
                  <button onClick={() => initiateTermination(prof, 'Faculty')} className="bg-slate-800 text-red-500 hover:bg-red-600 hover:text-white text-[9px] font-black px-4 py-2 rounded tracking-widest transition-colors uppercase">✕ Terminate</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROSTER_STUDENT */}
      {architectTab === 'ROSTER_STUDENT' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl w-full overflow-x-auto">
          <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 shrink-0 min-w-[800px]">
             <h3 className="text-lg font-black text-white uppercase tracking-widest">Active Student Roster</h3>
             <button onClick={handleBatchPromote} className="bg-emerald-900/30 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/50 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors shadow-lg">
                +1 Academic Year Batch Promotion
             </button>
          </div>
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 border-b border-slate-800">
              <tr><th className="pb-4 pl-2">Student Info</th><th className="pb-4">Yr & Sec</th><th className="pb-4">Login Detail</th><th className="pb-4 text-right pr-2">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {(activeStudents || []).map(student => (
                <tr key={student.id} className="hover:bg-slate-900 transition-colors">
                  <td className="py-4 pl-2">
                    <span className="text-sm text-white font-bold block mb-1">
                      {student.name} {student.role === 'ALUMNI' && <span className="text-purple-400 text-[10px] uppercase ml-2 bg-purple-900/20 px-2 rounded border border-purple-500/30">Alumni Tier</span>}
                      {student.role === 'TESTER' && <span className="text-amber-400 text-[10px] uppercase ml-2 bg-amber-900/20 px-2 rounded border border-amber-500/30">Beta Tester</span>}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">{student.id}</span>
                  </td>
                  <td className="py-4 text-slate-300 font-black text-xs">
                    {student.role === 'ALUMNI' ? 'Graduated Evaluator' : student.role === 'TESTER' ? 'QA / NDA Bound' : (
                        <div className="flex items-center gap-2">
                            <span>{student.year} - {student.section}</span>
                            {editingEntity === student.id ? (
                                <div className="flex gap-2 ml-2 items-center">
                                    <select 
                                      value={editValue} 
                                      onChange={e => setEditValue(e.target.value)} 
                                      className="w-16 bg-slate-950 border border-blue-500 text-blue-400 font-bold text-xs p-1.5 rounded outline-none text-center cursor-pointer uppercase"
                                    >
                                        <option value="" disabled>-</option>
                                        {sectionsList.map(num => <option key={num} value={num}>{num}</option>)}
                                    </select>
                                    <button onClick={() => handleInlineSave(student.id, 'SECTION')} className="text-emerald-500 hover:text-emerald-400 text-xs font-bold px-2 bg-emerald-900/20 border border-emerald-900/50 py-1 rounded">Save</button>
                                </div>
                            ) : (
                                <button onClick={() => { setEditingEntity(student.id); setEditValue(student.section || '1'); }} className="text-[9px] text-blue-500 hover:text-blue-400 uppercase tracking-widest ml-2">Edit</button>
                            )}
                        </div>
                    )}
                  </td>
                  <td className="py-4">
                    <span className="block text-[10px] text-blue-400 font-mono mb-1">{student.email}</span>
                  </td>
                  <td className="py-4 text-right pr-2 flex justify-end gap-2 items-center h-full">
                     <button onClick={() => { 
                         triggerModal({ 
                             type: 'CONFIRM', 
                             title: 'Resend Passcode?', 
                             message: `Dispatch new temporary credentials via SMTP to ${student.email}?`, 
                             onYes: async () => {
                                 try {
                                     const token = sessionStorage.getItem('token');
                                     const res = await fetch(`${API_BASE_URL}api/users/resend-passcode/${student.id}`, {
                                         method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
                                     });
                                     if (res.ok) alert(`[SYSTEM] Credentials dispatched to ${student.email}.`);
                                     else { const data = await res.json(); alert(`Failed: ${data.detail}`); }
                                 } catch (e) { alert("Network error."); }
                             } 
                         })
                     }} className="text-[9px] font-black px-3 py-1.5 rounded border border-slate-700 text-blue-400 hover:bg-slate-800 uppercase tracking-widest">Resend Pass</button>
                     
                     <button onClick={() => initiateTermination(student, 'Student')} className="text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest transition-colors border border-red-900/50 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white">✕ Expel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {activeStudents.length === 0 && <p className="text-slate-500 text-xs mt-4">No students found.</p>}
        </div>
      )}
    </>
  );
}