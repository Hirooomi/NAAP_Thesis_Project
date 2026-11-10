import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// THE PERMANENT ARCHITECTURE FIX
import { API_BASE_URL } from '../apiConfig';

// THE FIX: Accept props so Profile.jsx can pass down the specific role defaults
export default function Support({ defaultPriority = "NORMAL", requesterId, requesterRole }) {
  const navigate = useNavigate();
  // Use the explicitly passed ID, or fall back to local storage
  const storedId = requesterId || localStorage.getItem('userId') || '12324MN-000480'; 
  const userRole = requesterRole || localStorage.getItem('role') || 'STUDENT';

  const [category, setCategory] = useState('Account Access (Password Reset)');
  const [issueText, setIssueText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if(!issueText.trim()) {
        alert("[SYSTEM DENIED]: Message payload is empty. Please describe the issue before transmitting.");
        return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      
      // THE FIX: Strict alignment with Python 'TicketSubmitRequest' Schema!
      // We removed user_id and category because the JWT handles ID, and the AI handles triage folders.
      const payload = {
          issue_type: category,
          issue_text: issueText
      };

      // SYNCED TO API_BASE_URL
      const response = await fetch(`${API_BASE_URL}api/tickets/submit`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // THE FIX: Phase 2 Security Header
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        
        // Dynamic success message based on who submitted it
        const authMessage = userRole === 'FACULTY' 
          ? "Your faculty request has been flagged as URGENT and instantly routed to the Triage Board." 
          : "An administrator will review your case, and you will receive an automated email upon resolution.";

        alert(`[NAAP IT SUPPORT]\nTransmission Successful.\n\nOfficial Tracking ID: ${data.ticket_id}\n\nYour request has been securely logged in the Sentinel Database. ${authMessage}`);
        
        setIssueText("");
        
        // Route them back to their specific dashboard based on role
        if (userRole === 'FACULTY') navigate('/prof');
        else if (userRole.includes('ADMIN')) navigate('/admin');
        else navigate('/dashboard'); 
        
      } else {
        const errorData = await response.json();
        alert(`[SYSTEM ERROR]: Transmission failed. Server responded: ${errorData.detail}`);
      }
    } catch (error) {
      alert("[NETWORK ERROR]: Could not establish a secure connection to NAAP servers. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-10 max-w-3xl mx-auto w-full animate-fade-in">
       <header className="mb-6 md:mb-8 border-b border-slate-800 pb-4 md:pb-6 pt-4 md:pt-0">
          <h2 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">IT Support</h2>
          <p className="text-slate-400 font-mono mt-1 text-sm md:text-base">Submit system errors or module discrepancies.</p>
       </header>
       <form className="bg-slate-800 p-6 md:p-8 rounded-lg border border-slate-700 shadow-xl space-y-6" onSubmit={handleSubmit}>
          
          <div className="flex gap-4 mb-2">
              <div className="flex-1">
                <label className="block text-slate-300 text-sm font-bold mb-2">Sender ID</label>
                <input type="text" disabled value={storedId} className="w-full bg-slate-900 text-slate-500 px-4 py-3 rounded border border-slate-800 cursor-not-allowed font-mono" />
              </div>
              <div className="flex-1">
                <label className="block text-slate-300 text-sm font-bold mb-2">Clearance</label>
                <input type="text" disabled value={userRole} className={`w-full bg-slate-900 px-4 py-3 rounded border border-slate-800 cursor-not-allowed font-mono font-bold ${userRole === 'FACULTY' ? 'text-emerald-500' : 'text-blue-500'}`} />
              </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-bold mb-2">Issue Category</label>
            <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                className="w-full bg-slate-900 text-white px-4 py-3 rounded border border-slate-600 focus:border-blue-500 outline-none cursor-pointer"
            >
               <option>Account Access (Password Reset)</option>
               <option>Module PDF Not Loading</option>
               <option>Incorrect Quiz Evaluation</option>
               <option>Request Content Addition</option>
               {userRole === 'FACULTY' && <option>System Architecture / Triage Request</option>}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-2">Message Payload</label>
            <textarea 
                rows="5" 
                required 
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                className="w-full bg-slate-900 text-white px-4 py-3 rounded border border-slate-600 focus:border-blue-500 outline-none resize-none custom-scrollbar" 
                placeholder="Describe the issue in detail. If this pertains to a specific module or quiz, please state the title..."
            ></textarea>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`w-full ${userRole === 'FACULTY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-purple-600 hover:bg-purple-500'} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded uppercase tracking-widest transition-colors shadow-lg`}
          >
            {isSubmitting ? 'Transmitting to AI Worker...' : 'Transmit Request'}
          </button>
       </form>
    </div>
  );
}