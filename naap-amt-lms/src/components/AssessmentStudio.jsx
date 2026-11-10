import { useState, useRef, useEffect } from 'react';

// THE PERMANENT ARCHITECTURE FIX
import { API_BASE_URL } from '../apiConfig';

export default function AssessmentStudio({
  activeTab, setActiveTab, timeLimit, setTimeLimit, randomize, setRandomize,
  setDraftModal, setPublishModal, targetContext, setTargetContext,
  extractedChunks, questions, setQuestions, setCorrectAnswer,
  quizTargetFolder, quizTargetSubFolder, 
  handleSaveToHub // THE BUG FIX: Prop destructuring added so the app doesn't crash!
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isSyncingPattern, setIsSyncingPattern] = useState(false);
  const [quizCount, setQuizCount] = useState(10); 

  // THE FIX: Transition to sessionStorage for auth checks
  const userId = sessionStorage.getItem('userId') || "FAC-2024-0891";
  const profName = sessionStorage.getItem('profName') || "ALONZO, Eduardo";

  // ==========================================
  // WEBSOCKET FILE LOCK EMITTER
  // ==========================================
  useEffect(() => {
    // THE FIX: Transition to sessionStorage
    const token = sessionStorage.getItem('token');
    if (!token || !quizTargetSubFolder) return;

    const wsUrl = `${API_BASE_URL}api/ws/connect?token=${token}`.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
       ws.send(JSON.stringify({
          event: 'FILE_LOCK_STATUS',
          topic: quizTargetSubFolder,
          isLocked: true,
          profName: profName
       }));
    };

    return () => {
       if (ws.readyState === WebSocket.OPEN) {
           ws.send(JSON.stringify({
              event: 'FILE_LOCK_STATUS',
              topic: quizTargetSubFolder,
              isLocked: false,
              profName: profName
           }));
       }
       ws.close();
    };
  }, [quizTargetSubFolder, profName]);

  // ==========================================
  // DRAGGABLE DIVIDER SYSTEM
  // ==========================================
  const containerRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(35); 
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingDivider || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      if (newWidth > 20 && newWidth < 60) {
        setLeftWidth(newWidth);
      }
    };
    
    const handleMouseUp = () => setIsDraggingDivider(false);

    if (isDraggingDivider) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  // ==========================================
  // DYNAMIC MAX CHOICES SYSTEM
  // ==========================================
  const absoluteMaxChoices = activeTab === 'CAAP' ? 6 : activeTab === 'Lvl 2' ? 5 : 4;
  const [quizMaxChoices, setQuizMaxChoices] = useState(absoluteMaxChoices);

  if (quizMaxChoices > absoluteMaxChoices) {
      setQuizMaxChoices(absoluteMaxChoices);
  }

  const cleanOptionString = (str) => str.replace(/^[A-Z][\)\.]\s*/, '');

  const handleGenerateBulk = async () => {
    setIsGenerating(true);
    try {
      // THE FIX: Retrieve token for authorization headers
      const token = sessionStorage.getItem('token');
      const rawChunk = extractedChunks[0];
      if (!rawChunk) throw new Error("No source document found in memory.");

      const payload = {
        context: rawChunk.content, level: activeTab, topic: quizTargetSubFolder || "Aviation Topic", count: quizCount, max_choices: quizMaxChoices, user_id: userId 
      };

      // THE FIX: Added headers to bypass the 401 Unauthorized rejection
      const response = await fetch(`${API_BASE_URL}api/modules/generate-bulk`, {
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        }, 
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("AI Quiz Generation failed.");
      const data = await response.json();

      if (data.questions && data.questions.length > 0) {
        const newQuestions = data.questions.map((q, index) => {
          const cleanOptions = q.options ? q.options.map(cleanOptionString) : [];
          return {
            ...q,
            options: cleanOptions,
            ans: q.ans ? cleanOptionString(q.ans) : "",
            id: `gen_${Date.now()}_${index}`
          };
        });

        setQuestions(prev => ({ ...prev, [activeTab]: [...(prev[activeTab] || []), ...newQuestions] }));
      } else {
        alert(`The AI could not generate questions for ${quizTargetSubFolder}.`);
      }
    } catch (err) {
      alert(`Generation Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSingle = async (type) => {
     setIsGeneratingSingle(true);
     try {
        // THE FIX: Retrieve token
        const token = sessionStorage.getItem('token');
        const rawChunk = extractedChunks[0];
        if (!rawChunk) throw new Error("No source document found.");

        const payload = { context: rawChunk.content, type: type, level: activeTab, topic: quizTargetSubFolder || "Aviation Topic", user_id: userId };

        // THE FIX: Inject auth header
        const response = await fetch(`${API_BASE_URL}api/modules/generate-single`, {
          method: 'POST', 
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
          }, 
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("AI Generation failed.");
        const data = await response.json();

        if (data.status === "success" && data.question) {
          const cleanOptions = data.question.options ? data.question.options.map(cleanOptionString) : [];
          const newQ = { 
            ...data.question, 
            options: cleanOptions,
            ans: data.question.ans ? cleanOptionString(data.question.ans) : "",
            id: `gen_${Date.now()}` 
          };
          setQuestions(prev => ({ ...prev, [activeTab]: [...(prev[activeTab] || []), newQ] }));
        }
     } catch (err) {
        alert(`Generation Error: ${err.message}`);
     } finally {
        setIsGeneratingSingle(false);
     }
  };

  const handleAddManualPlaceholder = (type) => {
    let newOptions = [];
    if (type === 'MCQ') {
       for (let i=0; i < quizMaxChoices; i++) {
           newOptions.push(""); 
       }
    }
    const newQ = {
      id: `manual_${Date.now()}`, type: type, q: "", options: newOptions, ans: ""
    };
    setQuestions(prev => ({ ...prev, [activeTab]: [...(prev[activeTab] || []), newQ] }));
  };

  const handleAddOption = (qId) => {
    setQuestions(prev => {
      const updatedList = prev[activeTab].map(q => {
        if (q.id === qId && q.options.length < quizMaxChoices) {
          return { ...q, options: [...q.options, ""] };
        }
        return q;
      });
      return { ...prev, [activeTab]: updatedList };
    });
  };

  const handleRemoveOption = (qId, optIndexToRemove) => {
    setQuestions(prev => {
      const updatedList = prev[activeTab].map(q => {
        if (q.id === qId && q.options.length > 2) {
          const newOptions = q.options.filter((_, idx) => idx !== optIndexToRemove);
          const newAns = q.ans === q.options[optIndexToRemove] ? "" : q.ans;
          return { ...q, options: newOptions, ans: newAns };
        }
        return q;
      });
      return { ...prev, [activeTab]: updatedList };
    });
  };

  // ==========================================
  // HTML5 DRAG & DROP FOR OPTIONS
  // ==========================================
  const [draggedOptionInfo, setDraggedOptionInfo] = useState(null);

  const handleDragStart = (e, qId, oIdx) => {
    setDraggedOptionInfo({ qId, oIdx });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, qId, dropIdx) => {
    e.preventDefault();
    if (!draggedOptionInfo || draggedOptionInfo.qId !== qId) return;
    
    const dragIdx = draggedOptionInfo.oIdx;
    if (dragIdx === dropIdx) return;

    setQuestions(prev => {
      const updatedList = prev[activeTab].map(q => {
        if (q.id === qId) {
          const newOptions = [...q.options];
          const [draggedItem] = newOptions.splice(dragIdx, 1);
          newOptions.splice(dropIdx, 0, draggedItem);
          return { ...q, options: newOptions };
        }
        return q;
      });
      return { ...prev, [activeTab]: updatedList };
    });
    setDraggedOptionInfo(null);
  };

  const handleCloneQuestion = async (questionData) => {
    setIsCloning(true);
    try {
      // THE FIX: Retrieve token
      const token = sessionStorage.getItem('token');
      const rawChunk = extractedChunks[0];
      const payload = {
        context: rawChunk ? rawChunk.content : "", level: activeTab, topic: quizTargetSubFolder || "Aviation Topic", reference_question: questionData, user_id: userId
      };

      // THE FIX: Inject auth header
      const response = await fetch(`${API_BASE_URL}api/modules/clone-question`, {
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        }, 
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("AI Cloning failed.");
      const data = await response.json();

      if (data.status === "success" && data.question) {
        const cleanOptions = data.question.options ? data.question.options.map(cleanOptionString) : [];
        const clonedQ = { 
          ...data.question, 
          options: cleanOptions,
          ans: data.question.ans ? cleanOptionString(data.question.ans) : "",
          id: `clone_${Date.now()}` 
        };
        setQuestions(prev => ({ ...prev, [activeTab]: [...(prev[activeTab] || []), clonedQ] }));
      }
    } catch (err) {
      alert(`Clone Error: ${err.message}`);
    } finally {
      setIsCloning(false);
    }
  };

  const currentQuestions = questions[activeTab] || [];

  const handleSyncProfessorPattern = async () => {
    setIsSyncingPattern(true);
    try {
      // THE FIX: Retrieve token
      const token = sessionStorage.getItem('token');
      // THE FIX: Inject auth header
      const response = await fetch(`${API_BASE_URL}api/modules/analyze-pattern`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ user_id: userId, questions_list: currentQuestions })
      });

      if (!response.ok) throw new Error("Failed to communicate with AI Engine.");
      const data = await response.json();

      if (data.status === 'success') {
          alert("System Sync Complete: The AI has analyzed and stored your specific wording, formatting, and distractor patterns to ChromaDB.");
      } else {
          alert(`Sync Error: ${data.message}`);
      }
    } catch (err) {
      alert(`Sync Error: ${err.message}`);
    } finally {
      setIsSyncingPattern(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in flex flex-col w-full h-[88vh]">
      {/* HEADER */}
      <div className="bg-slate-950 border-b border-slate-800 p-4 flex justify-between items-center shrink-0 px-6">
         <div className="flex items-center gap-4">
           <span className="text-blue-500 text-xl">🧠</span>
           <span className="text-sm font-black text-white uppercase tracking-[0.2em]">Assessment Studio</span>
         </div>
      </div>

      <div className="flex-grow flex flex-col p-6 overflow-hidden">
        
        {/* TOP TOOLBAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-950 p-3 rounded-2xl border border-slate-800 mb-4 shadow-lg gap-4">
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
              {['CAAP', 'Lvl 1', 'Lvl 2'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="bg-pink-900/20 border border-pink-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
               <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest">Max Choices:</span>
               <input 
                 type="number" min="4" max={absoluteMaxChoices} value={quizMaxChoices} 
                 onChange={(e) => {
                     const val = Number(e.target.value);
                     if(val >= 4 && val <= absoluteMaxChoices) setQuizMaxChoices(val);
                 }} 
                 className="w-8 bg-transparent text-white text-center text-[10px] font-bold outline-none" 
               />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleSyncProfessorPattern} disabled={isSyncingPattern || currentQuestions.length === 0} className="bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/50 text-purple-400 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
               {isSyncingPattern ? 'ANALYZING...' : '🧠 Sync Prof Pattern'}
            </button>
            <div className="w-px h-6 bg-slate-800 mx-1"></div>

            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-[9px] font-black text-slate-500 uppercase">Timer:</span>
              <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className="w-10 bg-transparent text-white text-center text-xs outline-none" />
            </div>
            
            <button onClick={() => setRandomize(!randomize)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${randomize ? 'bg-blue-900/30 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>Shuffle</button>
            
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            
            <button onClick={() => handleSaveToHub('QUIZ', questions)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg transition-colors">💾 Save to Hub</button>
          </div>
        </div>

        {/* DRAGGABLE DIVIDER LAYOUT */}
        <div className="flex-grow flex flex-row overflow-hidden relative gap-2" ref={containerRef}>
          
          {/* LEFT PANEL */}
          <div style={{ width: `${leftWidth}%`, minWidth: '250px' }} className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 pb-10">
            
            <div className="flex flex-col bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-[0_0_15px_rgba(59,130,246,0.1)] gap-4">
               <div>
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-1">Target Topic</span>
                  <span className="text-xs font-bold text-white bg-slate-900 px-3 py-1.5 rounded-md border border-slate-700 block truncate">{quizTargetSubFolder || "Unassigned"}</span>
               </div>
               
               <div className="flex items-center justify-between bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Q's:</span>
                 <input type="number" min="1" max="50" value={quizCount} onChange={(e) => setQuizCount(Number(e.target.value))} className="w-10 bg-transparent text-white text-center text-[11px] font-bold outline-none" />
               </div>

               <button onClick={handleGenerateBulk} disabled={isGenerating} className="w-full bg-amber-900/30 text-amber-500 border border-amber-500/50 hover:bg-amber-900/50 px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-amber-900/20">
                  {isGenerating ? 'SCANNING...' : '⚡ Auto-Gen Batch'}
               </button>
            </div>

            <div className="flex flex-col bg-slate-950 p-4 rounded-xl border border-slate-800 gap-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Create Blank Template:</span>
                <button onClick={() => handleAddManualPlaceholder('MCQ')} className="w-full bg-blue-900/30 border border-blue-500/50 text-blue-400 py-3 rounded-lg text-[10px] font-black uppercase hover:bg-blue-900/50 transition-colors shadow-sm">+ MCQ</button>
                <button onClick={() => handleAddManualPlaceholder('ID')} className="w-full bg-purple-900/30 border border-purple-500/50 text-purple-400 py-3 rounded-lg text-[10px] font-black uppercase hover:bg-purple-900/50 transition-colors shadow-sm">+ ID</button>
                <button onClick={() => handleAddManualPlaceholder('FILL')} className="w-full bg-cyan-900/30 border border-cyan-500/50 text-cyan-400 py-3 rounded-lg text-[10px] font-black uppercase hover:bg-cyan-900/50 transition-colors shadow-sm">+ FILL</button>
            </div>
          </div>

          {/* THE DRAGGABLE DIVIDER */}
          <div 
            onMouseDown={() => setIsDraggingDivider(true)}
            className={`w-3 mx-1 flex-shrink-0 cursor-col-resize flex items-center justify-center transition-colors z-20 group ${isDraggingDivider ? 'bg-blue-900/30' : 'hover:bg-slate-800/50'}`}
          >
             <div className={`w-0.5 h-16 rounded-full transition-colors ${isDraggingDivider ? 'bg-blue-500' : 'bg-slate-700 group-hover:bg-slate-500'}`}></div>
          </div>

          {/* RIGHT PANEL: CANVAS */}
          <div style={{ width: `calc(${100 - leftWidth}% - 28px)` }} className="flex-grow overflow-y-auto custom-scrollbar pl-2 space-y-4 pb-20 relative">
             {currentQuestions.length === 0 ? (
               <div className="absolute inset-0 m-4 flex flex-col items-center justify-center text-slate-600 bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                 <span className="text-5xl mb-4 opacity-50">📬</span>
                 <p className="text-xs font-black uppercase tracking-widest">Canvas Empty</p>
                 <p className="text-[10px] mt-2 opacity-70">Use the left panel to generate or add questions.</p>
               </div>
             ) : (
               currentQuestions.map((q, idx) => (
                 <div key={q.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 relative group hover:border-slate-700 transition-colors shadow-lg">
                   
                   <div className="absolute top-4 left-4 bg-slate-800 text-slate-400 text-[10px] font-black px-2 py-1 rounded uppercase flex items-center gap-2 shadow-sm border border-slate-700">
                      <span className="text-white bg-slate-900 px-1.5 rounded">{idx + 1}.</span> {q.type}
                   </div>
                   
                   <div className="absolute top-4 right-4 flex items-center gap-2">
                     <button onClick={() => handleCloneQuestion(q)} disabled={isCloning} className="bg-orange-900/30 text-orange-500 border border-orange-500/50 hover:bg-orange-900/50 px-3 py-1.5 rounded text-[9px] font-black uppercase transition-colors disabled:opacity-50">
                       {isCloning ? 'CLONING...' : '🪄 AI Scan & Clone'}
                     </button>
                     <button onClick={() => setQuestions(prev => ({ ...prev, [activeTab]: prev[activeTab].filter(item => item.id !== q.id) }))} className="text-slate-600 hover:text-red-500 text-lg font-black transition-colors ml-2">✕</button>
                   </div>
                   
                   <div className="mt-10 mb-4">
                     <textarea value={q.q} placeholder="Type your question here..." onChange={(e) => {
                       const updated = [...currentQuestions]; updated[idx].q = e.target.value;
                       setQuestions(prev => ({ ...prev, [activeTab]: updated }));
                     }} className="w-full bg-transparent text-white text-sm font-bold outline-none border-b border-transparent focus:border-slate-700 pb-1 resize-none overflow-hidden min-h-[40px]" />
                   </div>

                   {q.type === 'MCQ' && (
                     <div className="flex flex-col gap-2 mt-4">
                       {q.options.map((opt, oIdx) => {
                         const optionLetter = String.fromCharCode(65 + oIdx); 
                         const isCorrect = q.ans === opt && opt.trim() !== "";

                         return (
                           <div 
                              key={oIdx} 
                              draggable 
                              onDragStart={(e) => handleDragStart(e, q.id, oIdx)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, q.id, oIdx)}
                              onClick={() => setCorrectAnswer(activeTab, q.id, opt)} 
                              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 relative ${isCorrect ? 'bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                           >
                             <div className="text-slate-600 cursor-grab active:cursor-grabbing hover:text-white px-1" title="Drag to reorder">
                                 <span className="text-[12px]">⣿</span>
                             </div>

                             <div className={`font-black text-xs ${isCorrect ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {optionLetter}.
                             </div>

                             <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isCorrect ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`}>
                               {isCorrect && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                             </div>

                             <textarea value={opt} placeholder={`Type choice here...`} onChange={(e) => {
                                  const updated = [...currentQuestions];
                                  updated[idx].options[oIdx] = e.target.value;
                                  if (isCorrect) updated[idx].ans = e.target.value; 
                                  setQuestions(prev => ({ ...prev, [activeTab]: updated }));
                             }} className={`w-full bg-transparent outline-none text-xs resize-none h-auto overflow-hidden min-h-[20px] pr-6 ${isCorrect ? 'text-emerald-400 font-bold' : 'text-slate-400'}`} onClick={(e) => e.stopPropagation()} />

                             {q.options.length > 2 && (
                               <button onClick={(e) => { e.stopPropagation(); handleRemoveOption(q.id, oIdx); }} className="absolute right-3 text-slate-600 hover:text-red-500 font-bold transition-colors">✕</button>
                             )}
                           </div>
                         );
                       })}
                       
                       {q.options.length < quizMaxChoices && (
                          <button onClick={() => handleAddOption(q.id)} className="mt-2 border border-dashed border-slate-700 text-slate-500 hover:text-white hover:border-slate-500 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest transition-colors w-full md:w-auto px-4 self-start">
                            + Add Choice
                          </button>
                       )}
                     </div>
                   )}

                   {(q.type === 'ID' || q.type === 'FILL') && (
                     <div className="mt-4">
                       <input type="text" value={q.ans} onChange={(e) => setCorrectAnswer(activeTab, q.id, e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-emerald-400 text-xs font-bold outline-none focus:border-emerald-500" placeholder="Type correct answer here..." />
                     </div>
                   )}
                 </div>
               ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
}