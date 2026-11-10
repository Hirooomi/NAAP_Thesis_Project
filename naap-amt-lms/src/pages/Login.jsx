import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
);

export default function Login() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState('STUDENT_LOGIN'); 
  
  const [id, setId] = useState('');
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [yearLevel, setYearLevel] = useState('1st Year');
  const [section, setSection] = useState('1');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const sections = Array.from({length: 10}, (_, i) => (i + 1).toString());

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsProcessing(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    if (authMode === 'STUDENT_LOGIN' || authMode === 'FACULTY_LOGIN') {
      try {
        const response = await fetch(`${API_BASE_URL}api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: id.trim(), password: password }),
          signal: controller.signal 
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Invalid ID or Password');
        }

        const data = await response.json();
        
        // THE FIX: Universal standardized session storage initialization for the live sync hooks
        sessionStorage.clear();
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('role', data.role);
        sessionStorage.setItem('userId', data.id);
        
        if (data.subjects) {
            const subjectString = Array.isArray(data.subjects) ? data.subjects.join(', ') : data.subjects;
            sessionStorage.setItem('subjects', subjectString);
        } else {
            sessionStorage.setItem('subjects', 'General Aviation');
        }
        
        if (data.require_password_change) {
            sessionStorage.setItem('forcePassChange', 'true');
            if (data.role === 'STUDENT') sessionStorage.setItem('studentName', data.name);
            else sessionStorage.setItem('profName', data.name);
            // Route to profile where the change password UI lives
            navigate('/profile');
            return;
        }

        if (data.role === 'HEAD_ADMIN') {
          sessionStorage.setItem('profName', data.name);
          navigate('/admin');
        } else if (data.role === 'FACULTY') {
          sessionStorage.setItem('profName', data.name);
          navigate('/prof');
        } else {
          sessionStorage.setItem('studentName', data.name);
          const savedSessionData = localStorage.getItem('activeQuizSession');
          if (savedSessionData) {
              try {
                  const savedSession = JSON.parse(savedSessionData);
                  const elapsedSeconds = Math.floor((Date.now() - savedSession.timestamp) / 1000);
                  const remainingTime = savedSession.timeLeft - elapsedSeconds;
                  
                  if (remainingTime > 0) {
                      alert("⚠️ INTERRUPTED QUIZ DETECTED: You have an active assessment. Resuming now...");
                      navigate('/quiz-room', { 
                          state: { itemName: savedSession.itemName, difficulty: savedSession.difficulty, category: savedSession.category }
                      });
                      return; 
                  } else {
                      localStorage.removeItem('activeQuizSession');
                  }
              } catch(err) {
                  localStorage.removeItem('activeQuizSession');
              }
          }
          navigate('/dashboard');
        }
      } catch (err) { 
          if (err.name === 'AbortError') {
              setError("Network Timeout: Microsoft Dev Tunnels is currently overloaded. Please try logging in again.");
          } else {
              setError(err.message); 
          }
      } 
      finally { 
          setIsProcessing(false); 
          clearTimeout(timeoutId);
      }
      return;
    }

    if (authMode === 'FORGOT_PASSWORD') {
      if (!email || !email.includes('@')) { setError('Please enter a valid registered email address.'); setIsProcessing(false); return; }
      try {
        const response = await fetch(`${API_BASE_URL}api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Failed to dispatch reset token.');

        setSuccess(`OTP PIN sent to ${email}. Please check your inbox.`);
        setTimeout(() => {
          setAuthMode('OTP_VERIFICATION');
          setSuccess(''); setError(''); setPassword('');
        }, 2500);
      } catch (err) { setError(err.message); } 
      finally { setIsProcessing(false); }
      return;
    }

    if (authMode === 'OTP_VERIFICATION') {
      if (!otp || otp.length < 6) { setError('Please enter the valid 6-digit OTP PIN sent to your email.'); setIsProcessing(false); return; }
      if (!password || password.length < 4) { setError('Please enter a valid new password (minimum 4 characters).'); setIsProcessing(false); return; }

      try {
        const response = await fetch(`${API_BASE_URL}api/auth/verify-reset-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, otp: otp, new_password: password })
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'OTP Verification Failed.');
        }

        setSuccess('OTP Verified! Your password has been successfully updated.');
        setTimeout(() => {
          setAuthMode('STUDENT_LOGIN');
          setSuccess(''); setOtp(''); setEmail(''); setPassword('');
        }, 3000);
      } catch (err) { setError(err.message); }
      finally { setIsProcessing(false); }
      return;
    }

    if (authMode === 'STUDENT_SIGNUP') {
      if (!id || !email || !firstName || !lastName) { 
          setError('All fields are strictly required for registration.'); 
          setIsProcessing(false); 
          return; 
      }

      try {
        const response = await fetch(`${API_BASE_URL}api/users/unified-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              student_id: id.trim(), email: email.trim(), first_name: firstName.trim(),
              last_name: lastName.trim(), year_level: yearLevel, section: section
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Registration failed. System Error.');
        }

        setSuccess('Registration received! If verified, you will receive an email with your temporary password. Otherwise, your request has been queued for manual admin authorization.');
        setTimeout(() => {
          setAuthMode('STUDENT_LOGIN');
          setSuccess(''); setError(''); setPassword(''); setFirstName(''); setLastName('');
        }, 5000);
      } catch (err) { setError(err.message); }
      finally { setIsProcessing(false); }
      return;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 font-sans relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="mb-8 text-center relative z-10">
        <h1 className="text-5xl md:text-6xl font-black tracking-[0.3em] uppercase text-white drop-shadow-lg">NAAP <span className="text-blue-500">AMT</span></h1>
        <p className="text-slate-400 font-mono text-xs mt-3 uppercase tracking-[0.3em]">Theoretical Quiz Bank</p>
      </div>

      <div className={`w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 transition-all duration-300 animate-fade-in ${authMode === 'STUDENT_SIGNUP' ? 'max-w-2xl' : 'max-w-md'}`}>
        
        <h2 className="text-xl font-bold text-center text-white uppercase tracking-widest mb-8 border-b border-slate-800 pb-4">
          {authMode === 'FACULTY_LOGIN' ? 'Faculty Login' : 
           authMode === 'STUDENT_SIGNUP' ? 'Student Registration' : 
           authMode === 'FORGOT_PASSWORD' || authMode === 'OTP_VERIFICATION' ? 'Password Recovery' : 'Student Login'}
        </h2>

        {error && <div className="bg-red-900/20 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs font-bold text-center mb-6">{error}</div>}
        {success && <div className="bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 p-3 rounded-lg text-xs font-bold text-center mb-6 animate-fade-in">{success}</div>}

        <form onSubmit={handleAuth} className="space-y-6">
          
          {(authMode === 'FORGOT_PASSWORD' || authMode === 'OTP_VERIFICATION') && (
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Registered Email</label>
              <input type="email" required disabled={authMode === 'OTP_VERIFICATION'} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. student@naap.edu.ph" className={`w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white font-mono outline-none focus:border-blue-500 transition-colors shadow-inner ${authMode === 'OTP_VERIFICATION' ? 'opacity-50 cursor-not-allowed' : ''}`} />
            </div>
          )}

          {authMode === 'OTP_VERIFICATION' && (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Secure OTP PIN</label>
              <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="e.g. 849201" className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-emerald-400 font-bold tracking-[0.5em] text-center outline-none focus:border-emerald-500 transition-colors shadow-inner" maxLength={6} />
            </div>
          )}

          {(authMode === 'STUDENT_LOGIN' || authMode === 'FACULTY_LOGIN') && (
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                {authMode === 'FACULTY_LOGIN' ? 'Faculty ID / Admin ID' : 'Student ID'}
              </label>
              <input type="text" required value={id} onChange={(e) => setId(e.target.value)} placeholder={authMode === 'FACULTY_LOGIN' ? 'e.g. FAC-2024-0891' : 'e.g. 12324MN-000'} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white font-mono outline-none focus:border-blue-500 transition-colors shadow-inner" />
            </div>
          )}

          {authMode === 'STUDENT_SIGNUP' && (
            <div className="animate-fade-in space-y-6">
              <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl mb-4">
                  <p className="text-xs text-blue-400 text-center leading-relaxed">Enter your official credentials. If your ID is pre-authorized by the registrar, your account will activate instantly and a temporary password will be dispatched to your email. Otherwise, it will be sent to the Admin Queue for manual verification.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Student ID Number</label>
                    <input type="text" required value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. 12324MN-000" className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-blue-500 transition-colors shadow-inner font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">System Registered Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. hiromi@student.edu.ph" className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-blue-500 transition-colors shadow-inner" />
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">First Name</label>
                    <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-blue-500 transition-colors shadow-inner" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Last Name</label>
                    <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-blue-500 transition-colors shadow-inner" />
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Year Level</label>
                    <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none cursor-pointer focus:border-blue-500 shadow-inner">
                        <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Section</label>
                    <select value={section} onChange={(e) => setSection(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none cursor-pointer focus:border-blue-500 shadow-inner">
                        {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
                    </select>
                  </div>
              </div>
            </div>
          )}

          {(authMode === 'STUDENT_LOGIN' || authMode === 'FACULTY_LOGIN' || authMode === 'OTP_VERIFICATION') && (
            <div className="animate-fade-in relative">
              <div className="flex justify-between items-end mb-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {authMode === 'OTP_VERIFICATION' ? 'Create New Password' : 'Password'}
                </label>
                {(authMode === 'STUDENT_LOGIN' || authMode === 'FACULTY_LOGIN') && (
                  <button type="button" onClick={() => { setAuthMode('FOR পলFORGOT_PASSWORD'); setError(''); setSuccess(''); setEmail(''); setIsProcessing(false); }} className="text-[9px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-widest transition-colors">
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-950 border border-slate-700 p-4 pr-12 rounded-xl text-white font-mono outline-none focus:border-blue-500 transition-colors shadow-inner" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors active:scale-90">
                   {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={isProcessing} className="w-full text-white font-black py-4 rounded-xl uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] mt-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 shadow-blue-900/20">
            {isProcessing ? 'PROCESSING...' : 
             authMode === 'STUDENT_SIGNUP' ? 'Submit Registration' : 
             authMode === 'FORGOT_PASSWORD' ? 'Send OTP Pin' : 
             authMode === 'OTP_VERIFICATION' ? 'Verify & Reset' : 'LOGIN'}
          </button>
        </form>

        <div className="mt-8 flex flex-col gap-3 text-center border-t border-slate-800 pt-6">
          {authMode === 'STUDENT_LOGIN' && (
            <>
              <button onClick={() => { setAuthMode('STUDENT_SIGNUP'); setError(''); setSuccess(''); setId(''); setPassword(''); setIsProcessing(false); }} className="text-[10px] text-slate-500 hover:text-white font-bold uppercase tracking-widest transition-colors">Create Student Account</button>
              <button onClick={() => { setAuthMode('FACULTY_LOGIN'); setError(''); setSuccess(''); setId(''); setPassword(''); setIsProcessing(false); }} className="text-[10px] text-slate-600 hover:text-blue-500 font-bold uppercase tracking-widest transition-colors mt-2">Faculty / Admin Access →</button>
            </>
          )}
          
          {(authMode === 'STUDENT_SIGNUP' || authMode === 'FORGOT_PASSWORD' || authMode === 'OTP_VERIFICATION') && (
            <button onClick={() => { setAuthMode('STUDENT_LOGIN'); setError(''); setSuccess(''); setId(''); setPassword(''); setIsProcessing(false); }} className="text-[10px] text-slate-500 hover:text-white font-bold uppercase tracking-widest transition-colors">← Back to Student Login</button>
          )}

          {authMode === 'FACULTY_LOGIN' && (
            <button onClick={() => { setAuthMode('STUDENT_LOGIN'); setError(''); setSuccess(''); setId(''); setPassword(''); setIsProcessing(false); }} className="text-[10px] text-slate-500 hover:text-blue-400 font-bold uppercase tracking-widest transition-colors">← Return to Student Portal</button>
          )}
        </div>

      </div>
    </div>
  );
}