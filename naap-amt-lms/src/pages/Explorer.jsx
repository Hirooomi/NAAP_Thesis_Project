import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// THE PERMANENT ARCHITECTURE FIX
import { API_BASE_URL } from '../apiConfig';
// THE FIX: Import the live sync engine
import useLiveSync from '../components/shared/useLiveSync';

export default function Explorer({ mode }) {
  const navigate = useNavigate();
  const location = useLocation(); 
  
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [moduleSearch, setModuleSearch] = useState('');
  const [topicProgress, setTopicProgress] = useState({});
  const [readModules, setReadModules] = useState([]);
  
  const [curriculum, setCurriculum] = useState({});

  // THE MASTER CAAP SKELETON
  const baseCurriculum = {
    'AIR LAW & AIRWORTHINESS': { 
      'PCAR Parts 1, 2, 5, 6, 8 / AFCAR': [], 'Airframe Inspection': [], 'Maintenance Forms & Records': [], 'Maintenance Publications': [], 'Mechanic Privileges & Limitations': [] 
    },
    'NATURAL SCIENCE & AIRCRAFT GENERAL KNOWLEDGE': { 
      'Mathematics': [], 'Basic Physics': [], 'Materials & Processes': [] 
    },
    'AIRCRAFT ENGINEERING': { 
      'Materials & Processes': [], 'Fluid Lines & Fittings': [], 'Aircraft Instrument System': [], 'Sheet metal & Non-Metallic Structures': [], 'Welding': [], 'Assembly & Rigging': [], 'Wood Structures': [], 'Aircraft Finishes': [], 'Aircraft Electrical System': [], 'Engine Electrical System': [], 'Engine Instrument Systems': [], 'Engine Inspection': [] 
    },
    'AIRCRAFT MAINTENANCE': { 
      'Materials & Processes': [], 'Ground Operation & Servicing': [], 'Fluid Lines and Fittings': [], 'Cleaning & Corrosion Control': [], 'Maintenance Forms & Records': [], 'Sheet metal & Non-Metallic Structures': [], 'Hydraulic & Pneumatic Power System': [], 'Aircraft Fuel System': [], 'Aircraft Landing Gear System': [], 'Reciprocating Engines': [], 'Turbine Engines': [], 'Fuel Metering Systems': [], 'Engine Fuel System': [], 'Induction & Engine Airflow': [], 'Engine Inspection': [], 'Lubrication System': [] 
    },
    'POWERPLANT RATING': { 
      'Reciprocating Engines': [], 'Turbine Engines': [], 'Engine Instrument Systems': [], 'Ignition & Starting Systems': [], 'Fuel Metering Systems': [], 'Propellers': [], 'Auxiliary Power Unit': [], 'Induction & Engine Airflow System': [], 'Engine Inspection': [], 'Engine Fuel System': [], 'Lubrication System': [] 
    },
    'AIRFRAME RATING': { 
      'Wood Structures': [], 'Aircraft Finishes': [], 'Sheet metal & Non-Metallic Structures': [], 'Assembly & Rigging': [], 'Aircraft Landing Gear System': [], 'Hydraulic & Pneumatic Power System': [], 'Aircraft Fuel Systems': [], 'Ice & Rain Control System': [], 'Fire Protection System': [], 'Aircraft Electrical System': [], 'Engine Electrical System': [], 'Position & Warning System': [] 
    },
    'HUMAN PERFORMANCE AND LIMITATIONS': { 
      'Human Performance (OASIS)': [], 'Mechanic Privileges and Limitations': [] 
    }
  };

  const targetType = mode === 'quizzes' ? 'QUIZ' : 'MODULE';
  
  // THE FIX: Single-line silent fetch handling all WebSocket updates
  const { data: vaultData, isLoading } = useLiveSync(`api/vault/catalog?type=${targetType}`, ['VAULT_UPDATE']);

  // THE FIX: Watch for background syncs and re-run the CAAP fuzzy matcher seamlessly
  useEffect(() => {
    if (vaultData?.catalog) {
      const dbTree = JSON.parse(JSON.stringify(baseCurriculum));
      vaultData.catalog.forEach(item => {
         let placed = false;
         const normalizedCategory = (item.category || "").trim().toUpperCase();

         for (const mainCategory in dbTree) {
             if (dbTree[mainCategory][item.category] !== undefined) {
                 dbTree[mainCategory][item.category].push(item.title);
                 placed = true; break;
             }
             const subCategories = Object.keys(dbTree[mainCategory]);
             for (const sub of subCategories) {
                 if (sub.toUpperCase() === normalizedCategory || sub.toUpperCase().includes(normalizedCategory) || normalizedCategory.includes(sub.toUpperCase())) {
                     dbTree[mainCategory][sub].push(item.title);
                     placed = true; break;
                 }
             }
             if (placed) break;
             if (mainCategory.toUpperCase() === normalizedCategory || mainCategory.toUpperCase().includes(normalizedCategory)) {
                 dbTree[mainCategory][subCategories[0]].push(item.title);
                 placed = true; break;
             }
         }
         
         if (!placed) {
             if (!dbTree['UNCATEGORIZED ASSETS']) dbTree['UNCATEGORIZED ASSETS'] = { 'Recovered Files': [] };
             dbTree['UNCATEGORIZED ASSETS']['Recovered Files'].push(item.title);
         }
      });
      setCurriculum(dbTree);
    }
  }, [vaultData]);

  useEffect(() => {
    if (location.state?.openCategory) {
      setBreadcrumb([location.state.openCategory]);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const logs = JSON.parse(localStorage.getItem('sessionAnalytics')) || [];
    const progress = {};
    logs.forEach(log => {
      if (!progress[log.topic]) progress[log.topic] = { lvl1Pre: false, lvl1PostPass: false, lvl2Pre: false, lvl2PostPass: false };
      if (log.baseLevel === 'Lvl 1' && log.type === 'Pre') progress[log.topic].lvl1Pre = true;
      if (log.baseLevel === 'Lvl 1' && log.type === 'Post' && log.score >= 75) progress[log.topic].lvl1PostPass = true;
      if (log.baseLevel === 'Lvl 2' && log.type === 'Pre') progress[log.topic].lvl2Pre = true;
      if (log.baseLevel === 'Lvl 2' && log.type === 'Post' && log.score >= 75) progress[log.topic].lvl2PostPass = true;
    });
    setTopicProgress(progress);

    const modLogs = JSON.parse(localStorage.getItem('moduleLogs')) || [];
    const readTopics = modLogs.map(log => log.topic);
    setReadModules([...new Set(readTopics)]); 
  }, []);

  const getCurrentNode = () => {
    let node = curriculum;
    for (const key of breadcrumb) { 
        if (node[key] !== undefined) {
            node = node[key]; 
        } else {
            return {}; 
        }
    }
    return node;
  };

  const getFlattenedModules = (node) => {
    if (Array.isArray(node)) return node;
    let items = [];
    for (let key in node) {
        items = items.concat(getFlattenedModules(node[key]));
    }
    return items;
  };

  const calculateProgress = (node) => {
    const leaves = getFlattenedModules(node);
    if (leaves.length === 0) return 0;
    const completed = leaves.filter(leaf => readModules.includes(leaf)).length;
    return Math.round((completed / leaves.length) * 100);
  };

  const navigateBack = () => {
    if (breadcrumb.length > 0) { 
      setBreadcrumb(breadcrumb.slice(0, -1)); 
      setModuleSearch(''); 
    } else {
      navigate('/dashboard');
    }
  };

  const renderQuizButtons = () => {
    const itemName = breadcrumb[breadcrumb.length - 1]; 
    const prog = topicProgress[itemName] || { lvl1Pre: false, lvl1PostPass: false, lvl2Pre: false, lvl2PostPass: false };
    const currentCategory = breadcrumb.length > 0 ? breadcrumb[0] : 'General Aviation'; 

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full mt-4">
        {!prog.lvl1Pre ? (
          <button onClick={() => navigate('/quiz', { state: { itemName, difficulty: 'Lvl 1: Pre-Test', category: currentCategory } })} className="bg-emerald-900/20 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-700/50 hover:border-emerald-500 text-[10px] md:text-xs font-bold py-3 px-2 rounded uppercase transition-colors text-center">Lvl 1: Pre-Test</button>
        ) : (
          <button onClick={() => navigate('/quiz', { state: { itemName, difficulty: 'Lvl 1: Post-Test', category: currentCategory } })} className="bg-rose-900/20 hover:bg-rose-900/50 text-rose-400 border border-rose-700/50 hover:border-rose-500 text-[10px] md:text-xs font-bold py-3 px-2 rounded uppercase transition-colors text-center">Lvl 1: Post-Test</button>
        )}
        {!prog.lvl1PostPass ? (
          <button disabled className="bg-slate-950 text-slate-700 border border-slate-800 text-[10px] md:text-xs font-bold py-3 px-2 rounded uppercase cursor-not-allowed text-center">🔒 Lvl 2 Locked</button>
        ) : !prog.lvl2Pre ? (
          <button onClick={() => navigate('/quiz', { state: { itemName, difficulty: 'Lvl 2: Pre-Test', category: currentCategory } })} className="bg-emerald-900/20 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-700/50 hover:border-emerald-500 text-[10px] md:text-xs font-bold py-3 px-2 rounded uppercase transition-colors text-center">Lvl 2: Pre-Test</button>
        ) : (
          <button onClick={() => navigate('/quiz', { state: { itemName, difficulty: 'Lvl 2: Post-Test', category: currentCategory } })} className="bg-rose-900/20 hover:bg-rose-900/50 text-rose-400 border border-rose-700/50 hover:border-rose-500 text-[10px] md:text-xs font-bold py-3 px-2 rounded uppercase transition-colors text-center">Lvl 2: Post-Test</button>
        )}
        {!prog.lvl2PostPass ? (
          <button disabled className="bg-slate-950 text-slate-700 border border-slate-800 text-[10px] md:text-xs font-bold py-3 px-2 rounded uppercase cursor-not-allowed text-center">🔒 CAAP Locked</button>
        ) : (
          <button onClick={() => navigate('/quiz', { state: { itemName, difficulty: 'CAAP Exam', category: currentCategory } })} className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] text-[10px] md:text-xs font-bold py-3 px-2 rounded uppercase transition-colors text-center">CAAP Exam</button>
        )}
      </div>
    );
  };

  const currentNode = getCurrentNode();
  const isLeafArray = Array.isArray(currentNode);
  const isSearching = moduleSearch.length > 0;
  
  let displayItems = [];
  if (isSearching) {
      displayItems = getFlattenedModules(curriculum).filter(item => item.toLowerCase().includes(moduleSearch.toLowerCase()));
  } else if (isLeafArray) {
      displayItems = currentNode; 
  } else if (typeof currentNode === 'object' && currentNode !== null) {
      displayItems = Object.keys(currentNode); 
  }

  if (isLoading) {
     return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-blue-500 font-mono text-sm animate-pulse uppercase tracking-widest">Connecting to Database Vault...</div>;
  }

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto w-full">
      <header className="mb-6 flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-slate-800 pb-6 pt-4 md:pt-0">
         <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">{mode === 'modules' ? 'Module Library' : 'Theoretical Quiz Bank'}</h2>
            <p className="text-slate-400 font-mono mt-1 text-sm md:text-base">Database Explorer Status: <span className="text-emerald-400">ONLINE</span></p>
         </div>
      </header>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between bg-slate-800 p-3 rounded border border-slate-700 gap-3">
        <div className="flex items-center gap-3 text-sm font-mono overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button onClick={navigateBack} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded uppercase font-bold tracking-widest transition-colors flex items-center gap-2 shrink-0">← Back</button>
          <span className="text-slate-600 shrink-0">|</span>
          <button onClick={() => setBreadcrumb([])} className="text-blue-400 hover:text-white uppercase font-bold whitespace-nowrap shrink-0">ROOT</button>
          {breadcrumb.map((crumb, i) => (
            <div key={i} className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <span className="text-slate-600">/</span>
              <button onClick={() => setBreadcrumb(breadcrumb.slice(0, i + 1))} className="text-blue-400 hover:text-white uppercase font-bold">{crumb}</button>
            </div>
          ))}
        </div>
      </div>

      {mode === 'quizzes' && breadcrumb.length > 0 && !isSearching && (
        <div className="bg-slate-900 border-2 border-amber-500/30 p-4 md:p-6 rounded-lg mb-6 shadow-[0_0_30px_rgba(217,119,6,0.1)]">
           <div className="flex flex-col justify-between mb-4">
              <div>
                 <h3 className="text-amber-400 font-bold uppercase tracking-widest text-lg md:text-xl flex items-center gap-2"><span>⭐</span> {breadcrumb[breadcrumb.length - 1]} Assessment</h3>
                 <p className="text-slate-400 text-xs font-mono mt-1">Take the macro assessment for this specific category or subtopic.</p>
              </div>
           </div>
           {renderQuizButtons()}
        </div>
      )}

      <div className="bg-slate-800 p-4 md:p-6 rounded border border-slate-700 shadow-xl min-h-[500px]">
        {displayItems.length === 0 ? <p className="text-slate-500 text-center font-mono py-10">No assets deployed in this directory yet.</p> : (!isLeafArray && !isSearching) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayItems.map(category => {
              const targetNode = currentNode[category] || curriculum[category];
              const progress = calculateProgress(targetNode);
              
              return (
                <button key={category} onClick={() => setBreadcrumb([...breadcrumb, category])} className="bg-slate-900 border border-slate-700 hover:border-blue-500 p-5 md:p-6 rounded text-left group transition-transform hover:-translate-y-1 flex flex-col justify-between">
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider group-hover:text-blue-400 flex items-start gap-3 leading-snug">
                    <span className="text-blue-500 text-2xl group-hover:scale-110 transition-transform shrink-0">📁</span> 
                    {category}
                  </h2>
                  
                  {mode === 'modules' ? (
                    <div className="w-full mt-6 pt-3 border-t border-slate-800">
                       <div className="flex justify-between text-xs font-mono mb-2">
                         <span className="text-slate-500 uppercase font-bold tracking-widest">Completion</span>
                         <span className={progress === 100 ? 'text-emerald-400' : 'text-blue-400'}>{progress}%</span>
                       </div>
                       <div className="w-full bg-slate-800 rounded-full h-1.5 border border-slate-700 overflow-hidden">
                         <div className={`h-1.5 transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                       </div>
                    </div>
                  ) : (
                    <div className="w-full mt-6 pt-3 border-t border-slate-800 flex justify-between items-center"><p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Access Directory</p><span className="text-slate-600 group-hover:text-blue-500 font-bold">→</span></div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {displayItems.map(item => {
              const isCompleted = readModules.includes(item);
              
              return (
                <div key={item} className={`bg-slate-900 border p-4 md:p-5 rounded flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${isCompleted && mode === 'modules' ? 'border-emerald-500/50' : 'border-slate-700 hover:border-slate-500'}`}>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                     <h3 className="font-bold text-white text-base md:text-lg uppercase tracking-wider flex items-center gap-3">
                       <span className="text-slate-500 text-xl">{mode === 'modules' ? '📄' : '🧠'}</span> {item}
                     </h3>
                     {isCompleted && mode === 'modules' && <span className="bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/50 w-max">COMPLETED</span>}
                  </div>
                  {mode === 'modules' ? (
                    <button 
                      onClick={() => {
                        const existingLogs = JSON.parse(localStorage.getItem('moduleLogs')) || [];
                        if(!existingLogs.find(l => l.topic === item)) {
                            const newLog = { topic: item, date: new Date().toLocaleDateString() };
                            localStorage.setItem('moduleLogs', JSON.stringify([newLog, ...existingLogs]));
                        }
                        navigate(`/reader/${encodeURIComponent(item)}`, { state: { itemName: item } });
                      }} 
                      className={`w-full lg:w-auto ${isCompleted ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'} text-white text-sm font-bold py-3 px-8 rounded uppercase tracking-widest shadow-lg transition-colors`}
                    >
                      Open Document
                    </button>
                  ) : (
                    <button onClick={() => navigate(`/quiz/${encodeURIComponent(item)}`, { state: { itemName: item, difficulty: 'Lvl 1: Pre-Test', category: breadcrumb[0] || 'General' } })} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded text-xs uppercase tracking-widest shadow-lg transition-colors">Start Assessment</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}