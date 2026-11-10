import { useState } from 'react';

export default function StudentRegistration() {
  const [step, setStep] = useState(1);
  const [studentId, setStudentId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVerify = async () => {
    if(!studentId || !firstName || !lastName) {
      alert("All fields are required.");
      return;
    }
    setIsProcessing(true);
    try {
      // Backend check: Does this ID and Name exist in the pre-approved whitelist?
      const res = await fetch('https://v7k00hrv-8000.asse.devtunnels.ms/api/users/verify-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, first_name: firstName, last_name: lastName })
      });
      if (res.ok) {
          setStep(2);
      } else {
          alert("Verification failed. ID and Name do not match our pre-approved records.");
      }
    } catch (err) {
      alert("Server connection failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegister = async () => {
    if(!email || !password) {
       alert("Email and password are required.");
       return;
    }
    setIsProcessing(true);
    try {
      // Finalize the account creation
      const res = await fetch('https://v7k00hrv-8000.asse.devtunnels.ms/api/users/claim-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, email: email, password: password })
      });
      if (res.ok) {
         alert("Account activated successfully! You can now log in.");
         window.location.href = '/'; // Replace with your actual login route
      } else {
         alert("Registration failed. Email might already be taken.");
      }
    } catch (err) {
      alert("Server connection failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 p-8 md:p-10 rounded-3xl shadow-2xl max-w-md w-full">
        <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2 text-center border-b border-slate-800 pb-4">
           {step === 1 ? 'Student Verification' : 'Claim Account'}
        </h2>
        
        {step === 1 && (
          <div className="space-y-5 mt-6">
            <p className="text-xs text-slate-400 text-center mb-6 leading-relaxed">Enter your credentials exactly as registered with the university to claim your account.</p>
            <div>
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Student ID Number</label>
              <input type="text" value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="12324MN-000" className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs p-4 rounded-xl outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">First Name</label>
              <input type="text" value={firstName} onChange={e=>setFirstName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold p-4 rounded-xl outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Last Name</label>
              <input type="text" value={lastName} onChange={e=>setLastName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold p-4 rounded-xl outline-none focus:border-blue-500" />
            </div>
            <button onClick={handleVerify} disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-xl mt-4 disabled:opacity-50 active:scale-95">
              {isProcessing ? 'Verifying...' : 'Verify Identity'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 mt-6 animate-fade-in">
            <p className="text-xs text-emerald-400 text-center mb-6 font-bold bg-emerald-900/20 py-3 rounded-xl border border-emerald-900/50">Identity Verified. Please set up your login.</p>
            <div>
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Email Address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="student@naap.edu.ph" className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs p-4 rounded-xl outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">New Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs p-4 rounded-xl outline-none focus:border-blue-500" />
            </div>
            <button onClick={handleRegister} disabled={isProcessing} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-xl mt-4 disabled:opacity-50 active:scale-95">
              {isProcessing ? 'Registering...' : 'Activate Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}