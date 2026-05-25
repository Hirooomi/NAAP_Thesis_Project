import { useState } from 'react';

export default function ModuleStudio({
  moduleTitle, isSplitScreen, setIsSplitScreen, uploadAsIs, canvaMenu, setCanvaMenu, 
  pdfUrl, extractedChunks, insertToEditor, sidebarAssets, setSidebarAssets, 
  placeObjectOnCanvas, shapeFillColor, setShapeFillColor, 
  selectedPaper, setSelectedPaper, paperSizes, currentDim, zoomLevel, setZoomLevel, 
  handleFormatBlock, pageCount, setPageCount, canvasObjects, setCanvasObjects, 
  handleDragEnd, contextMenu, setContextMenu, toggleLock, duplicateObject, alignObject, 
  handleEditorKeyDown, fontColor, 
  targetSubFolder,
  handleSaveToHub 
}) {

  const [extractingSection, setExtractingSection] = useState(null);

  const safeInsertText = (rawText) => {
    const editor = document.getElementById('module-paper-editor');
    if (!editor) return;

    const paragraphs = rawText.split('\n\n').filter(p => p.trim() !== '');
    
    if (editor.innerText.trim().startsWith("Start typing your module here")) {
      editor.innerHTML = ''; 
    }

    paragraphs.forEach(text => {
      if (text.length < 60 && !text.includes('.')) {
        const h2 = document.createElement('h2');
        h2.innerText = text;
        editor.appendChild(h2);
      } else {
        const p = document.createElement('p');
        p.innerText = text;
        editor.appendChild(p);
      }
      editor.appendChild(document.createElement('br'));
    });
  };

  const handleAutoExtract = async (sectionType) => {
    setExtractingSection(sectionType);
    try {
      const rawChunk = extractedChunks[0]; 
      if (!rawChunk) throw new Error("No raw document data found in memory.");

      const payload = {
        context: rawChunk.content,
        topic: targetSubFolder || "Aviation Topic", 
        section_type: sectionType 
      };

      // THE FIX: Retrieve the token from Local Storage
      const token = localStorage.getItem('token');

      const response = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/modules/paraphrase-topic', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // THE FIX: Inject the Security Header
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("AI Extraction failed.");
      
      const data = await response.json();
      
      if (data.status === "success" && data.text) {
        safeInsertText(data.text);
      } else {
        alert(`The AI could not find relevant information for: ${targetSubFolder}.`);
      }

    } catch (err) {
      alert(`Extraction Error: ${err.message}`);
    } finally {
      setExtractingSection(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in flex flex-col w-full h-[88vh]">
      <div className="bg-slate-950 border-b border-slate-800 p-3 flex justify-between items-center shrink-0 px-6">
        <div className="flex items-center gap-4">
          <span className="text-emerald-500 text-xl">📄</span>
          <span className="text-sm font-black text-white uppercase tracking-[0.1em]">{moduleTitle}</span>
        </div>
        <button onClick={() => setIsSplitScreen(!isSplitScreen)} className={`${uploadAsIs ? 'hidden' : 'flex'} text-[10px] font-black px-4 py-2 rounded-lg border uppercase tracking-widest transition-colors ${isSplitScreen ? 'bg-amber-900/30 border-amber-500/50 text-amber-400' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>{isSplitScreen ? 'Disable Split Screen' : 'Split Screen: 50/50 PDF'}</button>
      </div>

      <div className="flex-grow flex overflow-hidden bg-slate-950 relative w-full">
        <div className={`${uploadAsIs ? 'hidden' : 'flex'} flex-shrink-0 h-full overflow-hidden transition-all duration-300 border-r border-slate-800 ${isSplitScreen ? 'w-[50%] min-w-0' : 'w-80 min-w-0'}`}>
          <div className="w-20 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-4 space-y-6 z-20 shrink-0">
            <button onClick={() => setCanvaMenu('DESIGN')} className={`flex flex-col items-center gap-1 ${canvaMenu === 'DESIGN' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}><span className="text-xl">📄</span><span className="text-[8px] font-black uppercase">Source</span></button>
            <button onClick={() => setCanvaMenu('TEXT')} className={`flex flex-col items-center gap-1 ${canvaMenu === 'TEXT' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}><span className="text-xl">T</span><span className="text-[8px] font-black uppercase">Text</span></button>
            <button onClick={() => setCanvaMenu('ELEMENTS')} className={`flex flex-col items-center gap-1 ${canvaMenu === 'ELEMENTS' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}><span className="text-xl">⬛</span><span className="text-[8px] font-black uppercase">Shapes</span></button>
            <button onClick={() => setCanvaMenu('UPLOADS')} className={`flex flex-col items-center gap-1 ${canvaMenu === 'UPLOADS' ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}><span className="text-xl">☁️</span><span className="text-[8px] font-black uppercase">Uploads</span></button>
          </div>
          
          <div className="flex-grow bg-slate-900 flex flex-col h-full z-10 w-full overflow-hidden">
            {canvaMenu === 'DESIGN' && (
              <div className="flex-grow flex flex-col p-2 bg-slate-950 h-full">
                <p className="text-[9px] text-amber-400 font-black uppercase tracking-widest mb-2 text-center p-2">Original PDF Source</p>
                <div className="flex-grow bg-slate-900 rounded-lg overflow-hidden border border-slate-800 relative w-full h-full">
                  {pdfUrl ? <embed src={pdfUrl} type="application/pdf" className="absolute inset-0 w-full h-full" /> : <div className="text-slate-600 text-xs p-10 text-center">No PDF Loaded</div>}
                </div>
              </div>
            )}

            {canvaMenu === 'TEXT' && (
                <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                  <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest text-center border-b border-slate-800 pb-2">AI Extraction Hub</p>
                  
                  <div className="bg-slate-950 border border-emerald-500/30 p-4 rounded-xl group shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase mb-4 pb-2 border-b border-slate-800">
                      Locked Target: <span className="text-white">{targetSubFolder}</span>
                    </h4>
                    
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleAutoExtract('intro')} 
                        disabled={extractingSection !== null}
                        className="w-full bg-emerald-900/30 text-emerald-500 border border-emerald-500/50 text-[10px] font-black py-3 rounded-lg uppercase tracking-widest transition-all hover:bg-emerald-900/50 disabled:opacity-50"
                      >
                        {extractingSection === 'intro' ? 'GENERATING...' : '1. Extract Introduction'}
                      </button>

                      <button 
                        onClick={() => handleAutoExtract('body')} 
                        disabled={extractingSection !== null}
                        className="w-full bg-blue-900/30 text-blue-500 border border-blue-500/50 text-[10px] font-black py-3 rounded-lg uppercase tracking-widest transition-all hover:bg-blue-900/50 disabled:opacity-50"
                      >
                        {extractingSection === 'body' ? 'GENERATING...' : '2. Extract Body Paragraphs'}
                      </button>

                      <button 
                        onClick={() => handleAutoExtract('conclusion')} 
                        disabled={extractingSection !== null}
                        className="w-full bg-purple-900/30 text-purple-500 border border-purple-500/50 text-[10px] font-black py-3 rounded-lg uppercase tracking-widest transition-all hover:bg-purple-900/50 disabled:opacity-50"
                      >
                        {extractingSection === 'conclusion' ? 'GENERATING...' : '3. Extract Conclusion'}
                      </button>
                    </div>

                  </div>
                </div>
            )}

            {canvaMenu === 'UPLOADS' && (
                <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                  <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest text-center border-b border-slate-800 pb-2">Media Library</p>
                  <label className="w-full bg-slate-950 border border-dashed border-slate-700 text-slate-500 hover:text-blue-400 rounded-xl p-6 flex flex-col items-center cursor-pointer transition-colors">
                      <span className="text-3xl mb-2">📸</span><span className="text-[9px] font-black uppercase">Upload Real Image</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => { 
                        if(e.target.files[0]) {
                          const url = URL.createObjectURL(e.target.files[0]);
                          const img = new Image();
                          img.onload = () => {
                            let w = img.width > 600 ? 600 : img.width; let h = img.width > 600 ? (600 / img.width) * img.height : img.height;
                            setSidebarAssets([{id: `img-${Date.now()}`, type: 'image', icon: null, src: url, label: e.target.files[0].name, origW: w, origH: h}, ...sidebarAssets]); 
                          }; img.src = url;
                        }
                      }} />
                  </label>
                  {sidebarAssets.map(asset => (
                    <div key={asset.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl group hover:border-blue-500/50">
                      <div className="h-24 bg-slate-900 rounded-lg flex items-center justify-center text-4xl mb-3 border border-slate-800 overflow-hidden">
                        {asset.src ? <img src={asset.src} className="w-full h-full object-cover" /> : asset.icon}
                      </div>
                      <button onClick={() => placeObjectOnCanvas({ type: 'image', icon: asset.icon, src: asset.src, origW: asset.origW, origH: asset.origH })} className="w-full bg-slate-800 hover:bg-blue-900/30 text-blue-500 text-[9px] font-black py-2 rounded uppercase tracking-widest transition-colors">Add to Canva-Page</button>
                    </div>
                  ))}
                </div>
            )}

            {canvaMenu === 'ELEMENTS' && (
                <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4 text-center">
                  <p className="text-[9px] text-purple-400 font-black uppercase tracking-widest text-center border-b border-slate-800 pb-2">Shapes & Diagrams</p>
                  <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800 mb-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Shape Color:</span>
                      <input type="color" value={shapeFillColor} onChange={(e) => setShapeFillColor(e.target.value)} className="w-8 h-8 p-0 border-none cursor-pointer rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => placeObjectOnCanvas({ type: 'shape', element: <div className="w-full h-full rounded-sm pointer-events-none" style={{backgroundColor: shapeFillColor}}></div> })} className="bg-slate-950 border border-slate-800 p-6 rounded-lg hover:border-purple-500 flex justify-center"><div className="w-8 h-8 rounded-sm" style={{backgroundColor: shapeFillColor}}></div></button>
                      <button onClick={() => placeObjectOnCanvas({ type: 'shape', element: <div className="w-full h-full rounded-full pointer-events-none" style={{backgroundColor: shapeFillColor}}></div> })} className="bg-slate-950 border border-slate-800 p-6 rounded-lg hover:border-purple-500 flex justify-center"><div className="w-8 h-8 rounded-full" style={{backgroundColor: shapeFillColor}}></div></button>
                      <button onClick={() => placeObjectOnCanvas({ type: 'shape', element: <div className="w-0 h-0 border-l-[32px] border-r-[32px] border-b-[64px] border-l-transparent border-r-transparent pointer-events-none" style={{borderBottomColor: shapeFillColor}}></div> })} className="bg-slate-950 border border-slate-800 p-6 rounded-lg hover:border-purple-500 flex justify-center"><div className="w-0 h-0 border-l-[16px] border-r-[16px] border-b-[32px] border-l-transparent border-r-transparent" style={{borderBottomColor: shapeFillColor}}></div></button>
                      <button onClick={() => placeObjectOnCanvas({ type: 'shape', element: <div className="w-full h-4 mt-4 pointer-events-none" style={{backgroundColor: shapeFillColor}}></div> })} className="bg-slate-950 border border-slate-800 p-6 rounded-lg hover:border-purple-500 flex justify-center"><div className="w-full h-2 mt-3" style={{backgroundColor: shapeFillColor}}></div></button>
                  </div>
                </div>
            )}
          </div>
        </div>

        <div className="flex-grow flex flex-col h-full overflow-hidden bg-slate-200 relative min-w-0">
          <div className={`${uploadAsIs ? 'hidden' : 'flex'} bg-white border-b border-slate-300 p-2 flex-wrap gap-1 items-center shrink-0 shadow-sm z-30 justify-center lg:justify-start px-4`}>
            
            <div className="flex gap-2 mr-2 border-r border-slate-300 pr-2">
              <button onClick={() => {
                const editor = document.getElementById('module-paper-editor');
                if (editor) {
                    handleSaveToHub('MODULE', editor.innerHTML);
                    alert("Module successfully saved to Workspace Hub! You can now publish it.");
                }
            }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg transition-colors">
              💾 Save to Hub
            </button>
            </div>

            <div className="flex items-center bg-slate-100 rounded px-2 py-1 mr-1 border border-slate-300">
              <span className="text-[10px] font-black text-slate-500 uppercase mr-2">Page Size:</span>
              <select value={selectedPaper} onChange={(e) => setSelectedPaper(e.target.value)} className="bg-transparent text-[11px] font-bold outline-none text-emerald-600 cursor-pointer">
                {Object.keys(paperSizes).map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>

            <div className="flex items-center bg-slate-100 rounded px-2 py-1 mr-1 border border-slate-300">
              <span className="text-[10px] font-black text-slate-500 uppercase mr-2">Zoom:</span>
              <select value={zoomLevel} onChange={(e) => setZoomLevel(Number(e.target.value))} className="bg-transparent text-[11px] font-bold outline-none text-blue-600 cursor-pointer">
                <option value={0.2}>20%</option>
                <option value={0.5}>50%</option>
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
              </select>
            </div>

            <div className="w-px h-5 bg-slate-300 mx-1"></div>

            <div className="flex items-center bg-slate-100 rounded px-1">
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('undo', false, null); }} className="w-7 h-7 rounded hover:bg-slate-200 text-slate-700 text-xs font-black">↩</button>
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('redo', false, null); }} className="w-7 h-7 rounded hover:bg-slate-200 text-slate-700 text-xs font-black">↪</button>
            </div>
            <div className="w-px h-5 bg-slate-300 mx-1"></div>
            
            <select onChange={handleFormatBlock} className="bg-transparent border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700 font-sans outline-none font-bold w-24">
              <option value="p">Normal text</option><option value="H1">Heading 1</option><option value="H2">Heading 2</option>
            </select>
            
            <select onChange={(e) => { document.execCommand('fontName', false, e.target.value); }} className="bg-transparent border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700 font-sans outline-none w-24">
              <option value="Arial">Arial</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option>
            </select>
            
            <div className="flex items-center border border-slate-300 rounded ml-1 bg-white">
              <select onChange={(e) => { document.execCommand('fontSize', false, e.target.value); }} className="bg-transparent text-[11px] text-slate-800 outline-none w-16 text-center p-1">
                <option value="1">Small</option><option value="3">Normal</option><option value="5">Large</option><option value="7">Huge</option>
              </select>
            </div>
            <div className="w-px h-5 bg-slate-300 mx-1"></div>
            <div className="flex items-center">
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold', false, null); }} className="w-8 h-8 rounded hover:bg-slate-200 font-serif font-bold text-slate-800">B</button>
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic', false, null); }} className="w-8 h-8 rounded hover:bg-slate-200 font-serif italic text-slate-800">I</button>
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline', false, null); }} className="w-8 h-8 rounded hover:bg-slate-200 font-serif underline text-slate-800">U</button>
              <input type="color" onChange={(e) => document.execCommand('foreColor', false, e.target.value)} className="w-6 h-6 p-0 border-none cursor-pointer ml-1" title="Text Color" />
              <input type="color" onChange={(e) => document.execCommand('hiliteColor', false, e.target.value)} className="w-6 h-6 p-0 border-none cursor-pointer ml-1" title="Highlight Color" />
            </div>
            <div className="w-px h-5 bg-slate-300 mx-1"></div>
            <div className="flex items-center gap-1">
               <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyLeft', false, null); }} className="w-8 h-8 rounded hover:bg-slate-200 text-slate-600 text-xs font-black">≡</button>
               <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyCenter', false, null); }} className="w-8 h-8 rounded hover:bg-slate-200 text-slate-600 text-xs font-black">⍿</button>
               <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyRight', false, null); }} className="w-8 h-8 rounded hover:bg-slate-200 text-slate-600 text-xs font-black">☰</button>
            </div>
            <div className="w-px h-5 bg-slate-300 mx-1"></div>
            <div className="flex items-center gap-1">
               <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList', false, null); }} className="w-8 h-8 rounded hover:bg-slate-200 text-slate-600 text-xs font-black">•</button>
               <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertOrderedList', false, null); }} className="w-8 h-8 rounded hover:bg-slate-200 text-slate-600 text-xs font-black">1.</button>
            </div>
          </div>
          
          <div className="flex-grow overflow-auto custom-scrollbar p-6 md:p-10 flex justify-center bg-[#cbd5e1] relative w-full items-start">
            <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.2s', paddingBottom: '100px' }}>
                <div 
                  className="shadow-2xl border border-slate-400 relative flex flex-col bg-transparent z-0 transition-all duration-300"
                  style={{
                    width: `${currentDim.w}px`,
                    minHeight: `${currentDim.h * pageCount}px`,
                    backgroundImage: `repeating-linear-gradient(to bottom, #ffffff 0px, #ffffff ${currentDim.h}px, #cbd5e1 ${currentDim.h}px, #cbd5e1 ${currentDim.h + 24}px)`,
                    backgroundSize: `100% ${currentDim.h + 24}px`
                  }}
                >
                    {canvasObjects.map(obj => (
                      <div 
                        key={obj.id} draggable={!obj.isLocked} onDragEnd={(e) => handleDragEnd(e, obj.id)}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, objId: obj.id }); }}
                        className={`absolute flex flex-col items-center group transition-transform duration-200 ${obj.isBehind ? 'z-10 opacity-90' : 'z-30'}`} 
                        style={{ left: `${obj.x}px`, top: `${obj.y}px`, transform: `rotate(${obj.rotation || 0}deg)` }}
                      >
                        <div 
                          className={`border-2 ${obj.isLocked ? 'border-transparent' : 'border-transparent group-hover:border-blue-500'} relative flex items-center justify-center bg-transparent`}
                          style={{ width: `${obj.w}px`, height: `${obj.h}px`, resize: obj.isLocked ? 'none' : 'both', overflow: 'hidden' }}
                        >
                          {obj.type === 'image' ? (
                            obj.src ? <img src={obj.src} className="w-full h-full object-cover pointer-events-none" /> : <span className="text-7xl pointer-events-none">{obj.icon}</span>
                          ) : obj.element}
                        </div>
                        
                        {!obj.isLocked && (
                          <div 
                            className="absolute -bottom-12 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-2 bg-slate-900 p-2 rounded-lg shadow-2xl border border-slate-700 z-[100] before:content-[''] before:absolute before:inset-x-0 before:-top-8 before:h-8"
                            draggable={false} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          >
                            <span className="text-[8px] text-white font-black uppercase">Rotate</span>
                            <input type="range" min="0" max="360" value={obj.rotation || 0} onChange={(e) => setCanvasObjects(prev => prev.map(o => o.id === obj.id ? { ...o, rotation: parseInt(e.target.value) } : o))} className="w-24 accent-blue-500 cursor-pointer pointer-events-auto" />
                          </div>
                        )}

                        <div className="absolute -top-4 -right-4 hidden group-hover:flex gap-1 z-[100]">
                          <button onPointerDown={(e) => { e.stopPropagation(); setCanvasObjects(prev => prev.map(o => o.id === obj.id ? { ...o, isBehind: !o.isBehind } : o)); }} className="bg-slate-800 text-white rounded-full w-8 h-8 shadow-lg flex items-center justify-center font-black border border-slate-600 hover:bg-blue-600 transition-colors" title={obj.isBehind ? "Bring to Front" : "Send Behind Text"}>{obj.isBehind ? '↑' : '↓'}</button>
                          <button onPointerDown={(e) => { e.stopPropagation(); toggleLock(obj.id); }} className={`w-8 h-8 rounded-full shadow-lg flex items-center justify-center ${obj.isLocked ? 'bg-amber-500' : 'bg-slate-800'} text-white font-black`}>{obj.isLocked ? '🔒' : '🔓'}</button>
                        </div>
                      </div>
                    ))}

                    {contextMenu && (
                      <div onClick={() => setContextMenu(null)} className="fixed bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[500] w-52 py-2 animate-fade-in border-t-blue-500 border-t-2" style={{ top: contextMenu.y, left: contextMenu.x }}>
                        <button onClick={() => { duplicateObject(contextMenu.objId); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-800 flex justify-between uppercase text-slate-300">Duplicate <span className="opacity-40">Ctrl+D</span></button>
                        <button onClick={() => { alignObject(contextMenu.objId, 'center'); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-800 uppercase text-slate-300">Align Center</button>
                        <div className="h-px bg-slate-800 my-1 mx-2"></div>
                        <button onClick={() => { const link = prompt("Enter Hyperlink URL:"); if(link) setCanvasObjects(prev => prev.map(o => o.id === contextMenu.objId ? { ...o, link } : o)); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-800 text-blue-400 uppercase">Add Link</button>
                        <button onClick={() => { setCanvasObjects(prev => prev.filter(o => o.id !== contextMenu.objId)); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-red-900/20 text-red-500 uppercase">Delete Object</button>
                      </div>
                    )}

                    {uploadAsIs ? (
                      <div className="absolute inset-0 z-50 bg-slate-900 rounded-xl overflow-hidden flex flex-col shadow-2xl border border-slate-700 m-4">
                        <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">🔒 As-Is Mode Active (Original Format Locked)</span>
                          {/* THE BUG FIX: Dynamically grabs AI extracted text instead of saving a blank placeholder string! */}
                          <button onClick={() => {
                             const rawText = extractedChunks.map(c => c.content).join('\n\n');
                             handleSaveToHub('MODULE', rawText);
                             alert("Module successfully saved to Workspace Hub! You can now publish it.");
                          }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg transition-colors">
                             💾 Save to Hub
                          </button>
                        </div>
                        <div className="flex-grow bg-slate-800">
                          {pdfUrl ? <embed src={pdfUrl} type="application/pdf" className="w-full h-full" /> : <div className="flex h-full items-center justify-center text-slate-600 text-xs font-black uppercase tracking-widest">No Source Material Uploaded</div>}
                        </div>
                      </div>
                    ) : (
                      <div 
                      id="module-paper-editor" contentEditable="true" suppressContentEditableWarning={true} onKeyDown={handleEditorKeyDown}
                      className="flex-grow w-full p-16 font-sans leading-relaxed outline-none bg-transparent relative z-20 break-words whitespace-pre-wrap 
                      [&>h1]:text-4xl [&>h1]:font-black [&>h1]:mt-8 [&>h1]:mb-4 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mt-6 [&>h2]:mb-3 [&>h2]:text-blue-900 [&>p]:mb-4 [&>ul]:list-disc [&>ul]:ml-8"
                      style={{ minHeight: `${currentDim.h * pageCount}px`, color: fontColor, fontSize: '16px' }}
                      >
                        Start typing your module here. Press Tab to indent, and use the sidebar to insert Canva-style floating images...
                      </div>
                    )}
                </div>
                
                {!uploadAsIs && (
                  <div className="w-full flex justify-center mt-6">
                     <button onClick={() => setPageCount(p => p + 1)} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-black uppercase tracking-[0.2em] shadow-2xl border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 transition-colors">
                       + Add New Page
                     </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}