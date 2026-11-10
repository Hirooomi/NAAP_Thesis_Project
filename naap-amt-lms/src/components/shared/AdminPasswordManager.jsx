import React, { useState } from 'react';
import { API_BASE_URL } from '../../apiConfig';

export default function AdminPasswordManager({ userId, onClose }) {
  const [step, setStep] = useState(1);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const token = sessionStorage.getItem('token') || localStorage.getItem('token');

  const handleRequestOtp = async () => {
    setLoading(true);
    setFeedback({ type: '', text: '' });
    
    try {
      const res = await fetch(`${API_BASE_URL}api/auth/request-auth-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStep(2);
        setFeedback({ type: 'success', text: 'Secure OTP dispatched to your registered email.' });
      } else {
        setFeedback({ type: 'error', text: data.detail || 'Failed to send OTP.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Network connection failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setLoading(true);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}api/auth/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          old_password: oldPassword,
          otp: otp,
          new_password: newPassword
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Password secured and updated successfully. Closing module...' });
        setTimeout(() => onClose(), 2500);
      } else {
        setFeedback({ type: 'error', text: data.detail || 'Update failed. Check credentials.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Network connection failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6">Security Module</h2>
        
        {feedback.text && (
          <div className={`p-3 mb-6 rounded text-xs font-black uppercase tracking-widest text-center ${feedback.type === 'error' ? 'bg-red-900/30 text-red-500 border border-red-900' : 'bg-emerald-900/30 text-emerald-500 border border-emerald-900'}`}>
            {feedback.text}
          </div>
        )}

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <p className="text-slate-400 text-sm mb-2 text-center">To change your password, you must first verify your identity via email OTP.</p>
            <button 
              onClick={handleRequestOtp} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest py-3 rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Request Authorization OTP'}
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest mt-2">Cancel</button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Current Password</label>
              <input 
                type="password" 
                value={oldPassword} 
                onChange={(e) => setOldPassword(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">6-Digit OTP Code</label>
              <input 
                type="text" 
                maxLength="6"
                value={otp} 
                onChange={(e) => setOtp(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-amber-500 font-mono text-center tracking-[0.5em] focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">New Password</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                placeholder="Min 7 chars, 1 uppercase, 1 special..."
              />
            </div>
            
            <button 
              onClick={handleUpdatePassword} 
              disabled={loading || !oldPassword || !newPassword || otp.length !== 6}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest py-3 rounded transition-colors mt-4 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Commit Security Update'}
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest mt-2">Abort</button>
          </div>
        )}
      </div>
    </div>
  );
}