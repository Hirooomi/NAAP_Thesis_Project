import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// THE PERMANENT ARCHITECTURE FIX
import { API_BASE_URL } from '../apiConfig';
// THE FIX: Import the live sync engine
import useLiveSync from '../components/shared/useLiveSync';

import UploadTerminal from '../components/UploadTerminal';
import WorkspaceHub from '../components/WorkspaceHub';
import AssessmentStudio from '../components/AssessmentStudio';
import ModuleStudio from '../components/ModuleStudio';

export default function ProfUploadManager() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [files, setFiles] = useState([]);
  const [uploadState, setUploadState] = useState('IDLE'); 
  const [workspaceView, setWorkspaceView] = useState('HUB'); 
  const [logs, setLogs] = useState([]);
  const [uploadAsIs, setUploadAsIs] = useState(false); 
  const [isProcessingPhase3, setIsProcessingPhase3] = useState(false); 

  // THE FIX: Transitioned identity retrieval from localStorage to sessionStorage
  const profName = sessionStorage.getItem('profName') || "ALONZO, Eduardo";
  const userRole = sessionStorage.getItem('role') || 'FACULTY'; 
  const userId = sessionStorage.getItem('userId') || "FAC-2024-0891";

  const attributionString = userRole === 'HEAD_ADMIN'
    ? `HEAD ADMIN BYPASS OVERRIDE | Uploaded: ${new Date().toLocaleDateString()}`
    : `${profName} | Technical Instructor | Uploaded: ${new Date().toLocaleDateString()}`;

  const [moduleTitle, setModuleTitle] = useState("Untitled Aviation Module");
  const [contextMenu, setContextMenu] = useState(null); 

  // --- HUB STAGING STATES ---
  const [stagedModuleContent, setStagedModuleContent] = useState(null);
  const [stagedQuizContent, setStagedQuizContent] = useState(null);

  // --- THE FIX: GLOBAL SAFETY NET FOR UNSAVED CHANGES ---
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // If they are processing a file, or have staged files they haven't saved to DB yet
      if (uploadState !== 'IDLE' || stagedModuleContent || stagedQuizContent) {
        e.preventDefault();
        e.returnValue = ''; // Standard browser trigger for the warning dialog
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploadState, stagedModuleContent, stagedQuizContent]);

  const handleBackNavigation = () => {
    // Intercept internal routing if they have unsaved work
    if (uploadState !== 'IDLE' || stagedModuleContent || stagedQuizContent) {
      const confirmExit = window.confirm("WARNING: You have unsaved changes or active uploads. Exiting will destroy this session. Proceed?");
      if (!confirmExit) return;
    }

    if (location.state?.directTo || uploadState !== 'WORKSPACE' || workspaceView === 'HUB') {
        userRole === 'HEAD_ADMIN' ? navigate('/admin') : navigate('/prof');
    } else {
        setWorkspaceView('HUB'); 
    }
  };

  // --- TARGETING STATES ---
  const [moduleTargetFolder, setModuleTargetFolder] = useState("AIRFRAME RATING");
  const [moduleTargetSubFolder, setModuleTargetSubFolder] = useState("Aircraft Landing Gear System");
  const [quizTargetFolder, setQuizTargetFolder] = useState("AIRFRAME RATING");
  const [quizTargetSubFolder, setQuizTargetSubFolder] = useState("Aircraft Landing Gear System");

  const [isScanning, setIsScanning] = useState(false);
  const [scannedTopics, setScannedTopics] = useState([]);

  const jurisdictionFolders = {
    'AIR LAW & AIRWORTHINESS': ['PCAR Parts 1, 2, 5, 6, 8 / AFCAR', 'Airframe Inspection', 'Maintenance Forms & Records', 'Maintenance Publications', 'Mechanic Privileges & Limitations'],
    'NATURAL SCIENCE & AIRCRAFT GENERAL KNOWLEDGE': ['Mathematics', 'Basic Physics', 'Materials & Processes'],
    'AIRCRAFT ENGINEERING': ['Materials & Processes', 'Fluid Lines & Fittings', 'Aircraft Instrument System', 'Sheet metal & Non-Metallic Structures', 'Welding', 'Assembly & Rigging', 'Wood Structures', 'Aircraft Finishes', 'Aircraft Electrical System', 'Engine Electrical System', 'Engine Instrument Systems', 'Engine Inspection'],
    'AIRCRAFT MAINTENANCE': ['Materials & Processes', 'Ground Operation & Servicing', 'Fluid Lines and Fittings', 'Cleaning & Corrosion Control', 'Maintenance Forms & Records', 'Sheet metal & Non-Metallic Structures', 'Hydraulic & Pneumatic Power System', 'Aircraft Fuel System', 'Aircraft Landing Gear System', 'Reciprocating Engines', 'Turbine Engines', 'Fuel Metering Systems', 'Engine Fuel System', 'Induction & Engine Airflow', 'Engine Inspection', 'Lubrication System'],
    'POWERPLANT RATING': ['Reciprocating Engines', 'Turbine Engines', 'Engine Instrument Systems', 'Ignition & Starting Systems', 'Fuel Metering Systems', 'Propellers', 'Auxiliary Power Unit', 'Induction & Engine Airflow System', 'Engine Inspection', 'Engine Fuel System', 'Lubrication System'],
    'AIRFRAME RATING': ['Wood Structures', 'Aircraft Finishes', 'Sheet metal & Non-Metallic Structures', 'Assembly & Rigging', 'Aircraft Landing Gear System', 'Hydraulic & Pneumatic Power System', 'Aircraft Fuel Systems', 'Ice & Rain Control System', 'Fire Protection System', 'Aircraft Electrical System', 'Engine Electrical System', 'Position & Warning System'],
    'HUMAN PERFORMANCE AND LIMITATIONS': ['Human Performance (OASIS)', 'Mechanic Privileges and Limitations']
  };

  useEffect(() => { 
      if (jurisdictionFolders[moduleTargetFolder]) setModuleTargetSubFolder(jurisdictionFolders[moduleTargetFolder][0] || ""); 
  }, [moduleTargetFolder]);

  useEffect(() => { 
      if (jurisdictionFolders[quizTargetFolder]) setQuizTargetSubFolder(jurisdictionFolders[quizTargetFolder][0] || ""); 
  }, [quizTargetFolder]);

  useEffect(() => {
    if (location.state && location.state.directTo === 'QUIZ') {
      setUploadState('WORKSPACE');
      setWorkspaceView('QUIZ');
    }
  }, [location.state]);

  const [pdfUrl, setPdfUrl] = useState(null); 
  const [canvaMenu, setCanvaMenu] = useState('DESIGN'); 
  const [isSplitScreen, setIsSplitScreen] = useState(false); 
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedPaper, setSelectedPaper] = useState('Letter (Short)');
  const [pageCount, setPageCount] = useState(1);
  const paperSizes = { 'Letter (Short)': { w: 816, h: 1056 }, 'Legal (Long)': { w: 816, h: 1344 }, 'A4': { w: 794, h: 1123 }, 'A5': { w: 560, h: 794 } };
  const currentDim = paperSizes[selectedPaper];

  const [shapeFillColor, setShapeFillColor] = useState("#3B82F6"); 
  const [fontColor, setFontColor] = useState("#000000");
  const [extractedChunks, setExtractedChunks] = useState([]);
  const [sidebarAssets, setSidebarAssets] = useState([{ id: 'img1', type: 'image', icon: '⚙️', src: null, label: 'Magneto Cross-Section' }]);
  const [canvasObjects, setCanvasObjects] = useState([]);
  const [activeTab, setActiveTab] = useState('CAAP');
  const [timeLimit, setTimeLimit] = useState(15);
  const [randomize, setRandomize] = useState(true);
  const [aiLearningActive, setAiLearningActive] = useState(false);
  const [targetContext, setTargetContext] = useState(0);
  const [questions, setQuestions] = useState({ 'Lvl 1': [], 'Lvl 2': [], 'CAAP': [] });

  useEffect(() => { if (files.length > 0) setPdfUrl(URL.createObjectURL(files[0])); }, [files]);

  const startProcessing = async () => {
    if (files.length === 0) return alert("Please upload at least one PDF file first.");
    setUploadState('PROCESSING');
    setLogs(['> Initiating secure connection to NAAP Server...', '> Triggering AMT Sentinel Gatekeeper...']);

    try {
        const token = sessionStorage.getItem('token'); 
        const formData = new FormData();
        files.forEach(file => formData.append("files", file));
        formData.append("user_id", userId);
        formData.append("upload_as_is", uploadAsIs);

        const response = await fetch(`${API_BASE_URL}api/modules/upload`, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData 
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Server rejected the document.");

        if (data.chunks) setExtractedChunks(data.chunks);
        if (data.quiz_data) setQuestions(data.quiz_data);
        if (data.subject_category) setModuleTitle(`${data.subject_category}: ${files.length > 1 ? 'Merged Documents' : files[0].name.replace('.pdf', '')}`);

        setLogs(prev => [...prev, '> AI SUCCESS: Document mapped and stored in memory.', '> Opening Workspace Hub...']);
        setTimeout(() => setUploadState('WORKSPACE'), 2000);
    } catch (err) {
        setLogs(prev => [...prev, `> [CRITICAL ERROR]: ${err.message}`]);
        alert(`Upload Failed: ${err.message}`);
        setUploadState('IDLE'); 
    }
  };

  const handleScanTopics = async () => {
    setIsScanning(true);
    try {
      const token = sessionStorage.getItem('token'); 
      const rawChunk = extractedChunks[0];
      if (!rawChunk) throw new Error("No raw document data found in memory.");
      const payload = { context: rawChunk.content, user_id: userId };
      
      const response = await fetch(`${API_BASE_URL}api/modules/discover-topics`, {
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        }, 
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "AI Topic Scan failed.");
      }
      const data = await response.json();
      if (data.status === "success" && data.detected_topics && data.detected_topics.length > 0) {
        setScannedTopics(data.detected_topics);
        setModuleTargetSubFolder(data.detected_topics[0]);
        setQuizTargetSubFolder(data.detected_topics[0]);
      } else {
        alert("The AI could not confidently detect specific syllabus topics in this document.");
      }
    } catch (err) {
      alert(`Scan Error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpenStudio = async (studioType) => {
    setIsProcessingPhase3(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      setWorkspaceView(studioType);
    } catch (error) {
      alert("Failed to initialize studio environment.");
    } finally {
      setIsProcessingPhase3(false);
    }
  };

  const handleSaveToHub = (type, payloadData) => {
    if (type === 'MODULE') setStagedModuleContent(payloadData);
    if (type === 'QUIZ') setStagedQuizContent(payloadData);
    setWorkspaceView('HUB');
  };

  const executeDatabasePush = async (assetType, targetStatus) => {
    const token = sessionStorage.getItem('token'); 
    const assetId = `${assetType === 'QUIZ' ? 'QZ' : 'MOD'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const category = assetType === 'QUIZ' ? quizTargetSubFolder : moduleTargetSubFolder;
    const authorName = userRole === 'HEAD_ADMIN' ? 'Head Admin' : profName;
    
    let contentStr = "";
    let totalQuestions = 0;
    
    if (assetType === 'QUIZ') {
        contentStr = JSON.stringify(stagedQuizContent);
        totalQuestions = stagedQuizContent && Array.isArray(stagedQuizContent) ? stagedQuizContent.length : Object.values(stagedQuizContent || {}).flat().length;
    } else {
        contentStr = stagedModuleContent;
    }

    const payload = {
        id: assetId,
        type: assetType,
        title: moduleTitle,
        author: authorName,
        category: category,
        questions: totalQuestions,
        content_payload: contentStr,
        status: targetStatus
    };

    const res = await fetch(`${API_BASE_URL}api/vault/save`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error("Failed to save to Vault.");
  };

  const finalizeUploadFlow = async (actionType) => {
    setIsProcessingPhase3(true);
    try {
      const targetStatus = actionType.includes('DRAFT') ? 'DRAFT' : 'ACTIVE';
      
      if (actionType.includes('MODULE') || actionType.includes('BOTH')) {
         await executeDatabasePush('MODULE', targetStatus);
      }
      if (actionType.includes('QUIZ') || actionType.includes('BOTH')) {
         await executeDatabasePush('QUIZ', targetStatus);
      }
      
      alert(`System Sync Complete. Assets saved as ${targetStatus}.`);
      
      setUploadState('IDLE');
      setStagedModuleContent(null);
      setStagedQuizContent(null);
      
      userRole === 'HEAD_ADMIN' ? navigate('/admin') : navigate('/prof');
    } catch (err) {
      alert("Network error: Could not reach NAAP servers.");
    } finally {
      setIsProcessingPhase3(false);
    }
  };

  const handleFormatBlock = (e) => {
    const editor = document.getElementById('module-paper-editor');
    if (editor) editor.focus();
    document.execCommand('formatBlock', false, e.target.value);
    e.target.value = "p"; 
  };
  const insertToEditor = (text) => {
    const editor = document.getElementById('module-paper-editor');
    if (editor) { editor.focus(); document.execCommand('insertText', false, text); } 
  };
  const handleEditorKeyDown = (e) => {
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    '); }
  };
  const placeObjectOnCanvas = (obj) => {
    const newObj = { ...obj, id: `obj-${Date.now()}`, x: 150, y: 150, w: obj.origW || 180, h: obj.origH || 180, rotation: 0, isLocked: false, zIndex: 20, link: "" };
    setCanvasObjects([...canvasObjects, newObj]);
  };
  const duplicateObject = (id) => {
    const target = canvasObjects.find(o => o.id === id);
    if (!target) return;
    setCanvasObjects([...canvasObjects, { ...target, id: `obj-${Date.now()}`, x: target.x + 20, y: target.y + 20 }]);
  };
  const toggleLock = (id) => { setCanvasObjects(prev => prev.map(o => o.id === id ? { ...o, isLocked: !o.isLocked } : o)); };
  const alignObject = (id, type) => {
    setCanvasObjects(prev => prev.map(o => {
      if (o.id !== id) return o;
      if (type === 'center') return { ...o, x: (currentDim.w/2) - (o.w/2) };
      if (type === 'left') return { ...o, x: 20 };
      if (type === 'right') return { ...o, x: currentDim.w - o.w - 20 };
      return o;
    }));
  };
  const handleDragEnd = (e, objId) => {
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    setCanvasObjects(prev => prev.map(obj => obj.id === objId ? { ...obj, x: (e.clientX - rect.left) / zoomLevel - 50, y: (e.clientY - rect.top) / zoomLevel - 50 } : obj));
  };
  const setCorrectAnswer = (tab, qId, newAns) => {
    setQuestions(prev => ({ ...prev, [tab]: prev[tab].map(q => q.id === qId ? { ...q, ans: newAns } : q) }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-2 md:p-6 flex flex-col items-center overflow-x-hidden relative" onClick={() => setContextMenu(null)}>
      <div className="w-full max-w-[105rem] animate-fade-in flex flex-col h-full">
        <button 
          onClick={handleBackNavigation} 
          className="text-slate-600 hover:text-white text-[11px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 transition-colors shrink-0 w-max"
        >
          <span>←</span> Back
        </button>
        
        {uploadState !== 'WORKSPACE' && (
          <UploadTerminal files={files} setFiles={setFiles} uploadAsIs={uploadAsIs} setUploadAsIs={setUploadAsIs} uploadState={uploadState} startProcessing={startProcessing} logs={logs} />
        )}

        {uploadState === 'WORKSPACE' && workspaceView === 'HUB' && (
          <WorkspaceHub 
            moduleTitle={moduleTitle} setModuleTitle={setModuleTitle} 
            attributionString={attributionString} 
            userRole={userRole} 
            
            stagedModuleContent={stagedModuleContent}
            stagedQuizContent={stagedQuizContent}
            
            moduleTargetFolder={moduleTargetFolder} setModuleTargetFolder={setModuleTargetFolder} 
            moduleTargetSubFolder={moduleTargetSubFolder} setModuleTargetSubFolder={setModuleTargetSubFolder} 
            quizTargetFolder={quizTargetFolder} setQuizTargetFolder={setQuizTargetFolder} 
            quizTargetSubFolder={quizTargetSubFolder} setQuizTargetSubFolder={setQuizTargetSubFolder} 
            
            isScanning={isScanning} handleScanTopics={handleScanTopics} scannedTopics={scannedTopics}

            jurisdictionFolders={jurisdictionFolders} 
            finalizeUploadFlow={finalizeUploadFlow} 
            handleOpenStudio={handleOpenStudio} isProcessingPhase3={isProcessingPhase3} 
          />
        )}

        {uploadState === 'WORKSPACE' && workspaceView === 'MODULE' && (
          <ModuleStudio 
            moduleTitle={moduleTitle} isSplitScreen={isSplitScreen} setIsSplitScreen={setIsSplitScreen} 
            uploadAsIs={uploadAsIs} canvaMenu={canvaMenu} setCanvaMenu={setCanvaMenu} 
            pdfUrl={pdfUrl} extractedChunks={extractedChunks} insertToEditor={insertToEditor} 
            sidebarAssets={sidebarAssets} setSidebarAssets={setSidebarAssets} 
            placeObjectOnCanvas={placeObjectOnCanvas} shapeFillColor={shapeFillColor} setShapeFillColor={setShapeFillColor} 
            selectedPaper={selectedPaper} setSelectedPaper={setSelectedPaper} paperSizes={paperSizes} currentDim={currentDim} zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} 
            handleFormatBlock={handleFormatBlock} pageCount={pageCount} setPageCount={setPageCount} canvasObjects={canvasObjects} setCanvasObjects={setCanvasObjects} 
            handleDragEnd={handleDragEnd} contextMenu={contextMenu} setContextMenu={setContextMenu} toggleLock={toggleLock} duplicateObject={duplicateObject} alignObject={alignObject} handleEditorKeyDown={handleEditorKeyDown} fontColor={fontColor} 
            targetSubFolder={moduleTargetSubFolder} 
            handleSaveToHub={handleSaveToHub}
          />
        )}

        {uploadState === 'WORKSPACE' && workspaceView === 'QUIZ' && (
          <AssessmentStudio 
            activeTab={activeTab} setActiveTab={setActiveTab} timeLimit={timeLimit} setTimeLimit={setTimeLimit} randomize={randomize} setRandomize={setRandomize} 
            targetContext={targetContext} setTargetContext={setTargetContext} extractedChunks={extractedChunks} questions={questions} setQuestions={setQuestions} 
            setCorrectAnswer={setCorrectAnswer} aiLearningActive={aiLearningActive} setAiLearningActive={setAiLearningActive} 
            quizTargetFolder={quizTargetFolder} quizTargetSubFolder={quizTargetSubFolder} 
            handleSaveToHub={handleSaveToHub}
          />
        )}
      </div>
    </div>
  );
}