import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import QuizRoom from './pages/QuizRoom';
import Analytics from './pages/Analytics';
import ProfDashboard from './pages/ProfDashboard';
import ProfUploadManager from './pages/ProfUploadManager';
import ProfAnalytics from './pages/ProfAnalytics'; 
import Login from './pages/Login'; 
import ProfItemFrequency from './pages/ProfItemFrequency';
import HeadAdminDashboard from './pages/HeadAdminDashboard';
import Support from './pages/Support'; 
import Profile from './pages/Profile'; 

// --- SECURITY: ROLE-BASED ROUTE GUARD ---
const ProtectedRoute = ({ children, allowedRoles }) => {
  const userRole = localStorage.getItem('role'); 
  const isLoggedIn = !!localStorage.getItem('userId');

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    if (userRole === 'STUDENT') return <Navigate to="/dashboard" replace />;
    if (userRole === 'FACULTY') return <Navigate to="/prof" replace />;
    if (userRole === 'HEAD_ADMIN') return <Navigate to="/admin" replace />;
    return <Navigate to="/login" replace />; 
  }

  return children;
};

// MOCK READER
const MockReader = () => (
  <div className="p-4 md:p-10 flex flex-col items-center justify-center h-screen bg-slate-900">
    <div className="bg-slate-950 w-full max-w-4xl h-[80vh] rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
         <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Secure_Viewer_v2.01</span>
         <button onClick={() => window.history.back()} className="text-xs font-bold text-red-500 hover:text-white transition-colors">TERMINATE VIEW</button>
      </div>
      <span className="text-8xl mb-6 opacity-20">📄</span>
      <p className="text-slate-500 font-mono uppercase tracking-[0.5em] animate-pulse">Rendering PDF Content...</p>
    </div>
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['HEAD_ADMIN']}><HeadAdminDashboard /></ProtectedRoute>} />
      <Route path="/prof" element={<ProtectedRoute allowedRoles={['FACULTY', 'HEAD_ADMIN']}><ProfDashboard /></ProtectedRoute>} />
      <Route path="/prof/upload" element={<ProtectedRoute allowedRoles={['FACULTY', 'HEAD_ADMIN']}><ProfUploadManager /></ProtectedRoute>} />
      <Route path="/prof/analytics" element={<ProtectedRoute allowedRoles={['FACULTY', 'HEAD_ADMIN']}><ProfAnalytics /></ProtectedRoute>} />
      <Route path="/prof/frequency" element={<ProtectedRoute allowedRoles={['FACULTY', 'HEAD_ADMIN']}><ProfItemFrequency /></ProtectedRoute>} />
      
      {/* FIX: Appended /:id so it can catch dynamic module IDs like /reader/MOD-123 */}
      <Route path="/reader/:id" element={<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'HEAD_ADMIN']}><MockReader /></ProtectedRoute>} />

      <Route path="/" element={<Layout />}>
        <Route index element={localStorage.getItem('userId') ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
        
        <Route path="dashboard" element={<ProtectedRoute allowedRoles={['STUDENT']}><Dashboard /></ProtectedRoute>} />
        <Route path="modules" element={<ProtectedRoute allowedRoles={['STUDENT']}><Explorer mode="modules" /></ProtectedRoute>} />
        <Route path="quizzes" element={<ProtectedRoute allowedRoles={['STUDENT']}><Explorer mode="quizzes" /></ProtectedRoute>} />
        
        {/* FIX: Appended /:id so it can catch dynamic quiz IDs like /quiz/QZ-123, and allowed HEAD_ADMIN to view */}
        <Route path="quiz/:id" element={<ProtectedRoute allowedRoles={['STUDENT', 'HEAD_ADMIN']}><QuizRoom /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute allowedRoles={['STUDENT']}><Analytics /></ProtectedRoute>} />
        
        <Route path="support" element={<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'HEAD_ADMIN']}><Support /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'HEAD_ADMIN']}><Profile /></ProtectedRoute>} />
      </Route>
      
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}