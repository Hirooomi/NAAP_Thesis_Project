import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Support from './Support'; 

// THE PERMANENT ARCHITECTURE FIX
import { API_BASE_URL } from '../apiConfig';
import useLiveSync from "../components/shared/useLiveSync";

// Pure SVG Line Art Icons
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
);

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation(); 
  
  const userId = sessionStorage.getItem('userId') || 'UNKNOWN';
  const role = sessionStorage.getItem('role') || 'STUDENT';
  const isForcedChange = sessionStorage.getItem('forcePassChange') === 'true';

  const initialTab = location.state?.activeTab || (isForcedChange ? 'SECURITY' : 'MAILBOX');
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [otp, setOtp] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // THE FIX: Single-line silent fetch for System Inbox
  const { data: mailboxData, isLoading: isLoadingMail } = useLiveSync('api/comms/announcements', ['SYSTEM_MAIL']);
  const announcements = mailboxData?.announcements || [];

  const requestOTP = async () => {
    setIsProcessing(true);
    try {
      const token = sessionStorage.getItem('token'); 
      const response = await fetch(`${API_BASE_URL}api/auth/request-auth-otp`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ user_id: userId })
      });
      
      if (response.status === 429) {
          setTimeout(() => alert("⚠️ SECURITY COOLDOWN: Please wait 5 minutes before requesting another OTP. Check your inbox or spam folder for the previously sent email."), 100);
          return;
      }

      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Invalid server response format.");
      }

      if (response.ok) {
        setIsOtpSent(true);
        setTimeout(() => alert("[SYSTEM] OTP Dispatched to your registered email. Valid for 10 minutes."), 100);
      } else {
        setTimeout(() => alert(`[ERROR] ${data?.detail || "Request failed."}`), 100);
      }
    } catch (e) {
      setTimeout(() => alert(`Network error: ${e.message}`), 100);
    } finally {
      setIsProcessing(false); 
    }
  };

  const finalizePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    
    setIsProcessing(true);
    try {
      const token = sessionStorage.getItem('token'); 
      const response = await fetch(`${API_BASE_URL}api/auth/update-password`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ user_id: userId, old_password: oldPassword, otp, new_password: newPassword })
      });
      
      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Invalid server response format.");
      }

      if (response.ok) {
        sessionStorage.removeItem('forcePassChange'); 
        setTimeout(() => {
            alert("[SUCCESS] Password Secured.");
            if (role === 'FACULTY' || role === 'HEAD_ADMIN') navigate('/prof');
            else navigate('/dashboard'); 
        }, 100);
      } else {
        setTimeout(() => alert(`[ERROR] ${data?.detail || "Password update failed."}`), 100);
      }
    } catch (e) {
      setTimeout(() => alert(`Network error: ${e.message}`), 100);
    } finally {
      setIsProcessing(false); 
    }
  };

  return (
    <div className="p-4 md:p-10 max-w-5xl mx-auto w-full animate-fade-in">
      <header className="mb-8 border-b border-slate-800 pb-6 flex justify-between items-end">
        <div>
            <h2 className="text-3xl font-bold text-white uppercase tracking-wider">
            {role === 'STUDENT' ? 'Student Profile & Settings' : 'Faculty Command Center'}
            </h2>
            <p className="text-slate-400 font-mono mt-1">ID: {userId} | Role: <span className="text-emerald-400">{role}</span></p>
        </div>
        <button onClick={() => navigate(-1)} className="text-xs bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded uppercase tracking-widest transition-colors">← Back</button>
      </header>

      {isForcedChange && (
          <div className="mb-6 bg-amber-900/20 border border-amber-500/50 p-4 rounded-xl">
              <p className="text-amber-500 text-xs font-black uppercase tracking-widest">⚠️ Temporary Password Detected: Security protocol requires you to verify your old temp password and update it before accessing the system.</p>
          </div>
      )}

      <div className="flex gap-4 mb-8 border-b border-slate-800 pb-4">
        {['SECURITY', 'MAILBOX', 'IT_SUPPORT'].map(tab => (
          <button 
            key={tab} 
            disabled={isForcedChange && tab !== 'SECURITY'} 
            onClick={() => setActiveTab(tab)} 
            className={`text-xs font-black px-6 py-3 rounded-lg uppercase tracking-widest transition-colors ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed'}`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'SECURITY' && (
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl shadow-xl max-w-2xl relative">
          <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">Account Security</h3>
          <p className="text-xs text-slate-500 mb-8 leading-relaxed">To update your password, you must verify your identity. An OTP will be dispatched to your system-registered email address. (5 Minute Cooldown applies).</p>

          {!isOtpSent ? (
            <button onClick={requestOTP} disabled={isProcessing} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors border border-slate-600 shadow-lg active:scale-95">
              {isProcessing ? 'Dispatching...' : 'Request Security OTP via Email'}
            </button>
          ) : (
            <form onSubmit={finalizePasswordChange} className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Current / Old Password</label>
                    <div className="relative">
                       <input type={showOldPass ? "text" : "password"} required value={oldPassword} onChange={e=>setOldPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl outline-none focus:border-amber-500 pr-12 transition-colors" />
                       <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white active:scale-90 transition-all">
                         {showOldPass ? <EyeOffIcon /> : <EyeIcon />}
                       </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">6-Digit Email OTP</label>
                    <input type="text" required value={otp} onChange={e=>setOtp(e.target.value)} placeholder="000000" className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-center tracking-[1em] p-4 rounded-xl outline-none focus:border-blue-500" maxLength={6} />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">New Password</label>
                  <div className="relative">
                    <input type={showNewPass ? "text" : "password"} required value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl outline-none focus:border-blue-500 pr-12 transition-colors" />
                    <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white active:scale-90 transition-all">
                      {showNewPass ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirmPass ? "text" : "password"} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl outline-none focus:border-blue-500 pr-12 transition-colors" />
                    <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white active:scale-90 transition-all">
                      {showConfirmPass ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={isProcessing} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-lg shadow-emerald-900/20 active:scale-[0.98]">
                {isProcessing ? 'Securing Account...' : 'Lock In New Password'}
              </button>
              <button type="button" onClick={() => setIsOtpSent(false)} className="w-full text-center text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-widest mt-4 block">← Cancel / Resend OTP</button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'IT_SUPPORT' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4"><span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Routing to Support Module...</span></div>
            <Support defaultPriority={role === 'FACULTY' ? 'URGENT' : 'NORMAL'} requesterId={userId} requesterRole={role} /> 
        </div>
      )}

      {activeTab === 'MAILBOX' && (
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl shadow-xl min-h-[400px]">
             <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3"><span className="text-2xl">📬</span> System Inbox</h3>
             
             {isLoadingMail ? (
                 <p className="text-xs font-mono text-slate-500 uppercase tracking-widest text-center mt-20 animate-pulse">Syncing Global Data...</p>
             ) : announcements.length === 0 ? (
                 <p className="text-xs font-mono text-slate-500 uppercase tracking-widest text-center mt-20">Inbox is empty.</p>
             ) : (
                 <div className="space-y-4">
                     {announcements.sort((a,b) => new Date(b.date) - new Date(a.date)).map(msg => (
                         <div key={msg.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                             <div className="flex justify-between items-start mb-2">
                                 <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                                     msg.severity === 'CRITICAL' ? 'bg-red-900/30 text-red-500 border-red-900/50' : 
                                     msg.severity === 'URGENT' ? 'bg-amber-900/30 text-amber-500 border-amber-900/50' : 
                                     'bg-blue-900/30 text-blue-400 border-blue-900/50'
                                 }`}>{msg.severity}</span>
                                 <span className="text-[9px] font-mono text-slate-500">{msg.date}</span>
                             </div>
                             <h4 className="text-white font-bold text-md mb-2">{msg.header}</h4>
                             <p className="text-slate-400 text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                             <p className="text-[9px] text-slate-600 font-mono mt-4 uppercase tracking-widest border-t border-slate-800 pt-3">Author: {msg.author}</p>
                         </div>
                     ))}
                 </div>
             )}
        </div>
      )}
    </div>
  );
}