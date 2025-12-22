import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NetEditor } from './components/NetEditor';
import { CubeView } from './components/CubeView';
import { FaceData, FaceNode } from './types';
import { checkGeometricValidity, GRID_SIZE, buildFoldTree, PRESETS } from './utils';
import { RotateCw, Box, Layers, Play, Pause, Info, X, StepForward, StepBack, RotateCcw, ChevronDown } from 'lucide-react';

const App: React.FC = () => {
  // Initial T-Shape configuration
  const initialFaces: FaceData[] = [
    { id: 0, x: 2, y: 3, color: 'white', canvasRef: { current: null } }, // Bottom
    { id: 1, x: 2, y: 2, color: 'white', canvasRef: { current: null } }, // Center
    { id: 2, x: 2, y: 1, color: 'white', canvasRef: { current: null } }, // Top
    { id: 3, x: 1, y: 2, color: 'white', canvasRef: { current: null } }, // Left
    { id: 4, x: 3, y: 2, color: 'white', canvasRef: { current: null } }, // Right
    { id: 5, x: 2, y: 4, color: 'white', canvasRef: { current: null } }, // Bottom-most
  ];

  const [faces, setFaces] = useState<FaceData[]>(initialFaces);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredFaceId, setHoveredFaceId] = useState<number | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('t-shape');
  
  // Animation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [foldProgress, setFoldProgress] = useState(0); // 0 (flat) -> 1 (cube)
  const [animationDirection, setAnimationDirection] = useState<1 | -1>(1); // 1 = folding, -1 = unfolding
  const lastTimeRef = useRef<number>(0);
  const animationReq = useRef<number | null>(null);

  // Version counter to trigger texture updates in 3D
  const [textureVersion, setTextureVersion] = useState(0);
  
  // Validation
  const [validity, setValidity] = useState({ isValid: true, message: '' });

  // UI State
  const [showHelp, setShowHelp] = useState(true);

  // Computed Tree & Depth
  const { foldTree, maxDepth } = useMemo(() => {
      const tree = buildFoldTree(faces);
      let depth = 0;
      if (tree) {
          // BFS to find max depth
          const q = [{node: tree, d: 0}];
          while(q.length > 0) {
              const {node, d} = q.shift()!;
              depth = Math.max(depth, d);
              node.children.forEach(c => q.push({node: c, d: d+1}));
          }
      }
      return { foldTree: tree, maxDepth: depth || 1 };
  }, [faces]);

  useEffect(() => {
    const status = checkGeometricValidity(faces);
    setValidity(status as any);
  }, [faces]);

  // Animation Loop
  useEffect(() => {
    if (isPlaying) {
        const animate = (time: number) => {
            if (lastTimeRef.current === 0) lastTimeRef.current = time;
            const delta = time - lastTimeRef.current;
            lastTimeRef.current = time;

            // Speed: Full fold in 2 seconds
            const speed = 1 / 2000; 
            
            setFoldProgress(prev => {
                let next = prev + (delta * speed * animationDirection);
                if (next >= 1) {
                    next = 1;
                    setIsPlaying(false);
                } else if (next <= 0) {
                    next = 0;
                    setIsPlaying(false);
                }
                return next;
            });

            animationReq.current = requestAnimationFrame(animate);
        };
        animationReq.current = requestAnimationFrame(animate);
    } else {
        lastTimeRef.current = 0;
        if (animationReq.current) cancelAnimationFrame(animationReq.current);
    }

    return () => {
        if (animationReq.current) cancelAnimationFrame(animationReq.current);
    };
  }, [isPlaying, animationDirection]);

  const handleTextureUpdate = (id: number) => {
      setTextureVersion(v => v + 1);
  };

  const loadPreset = (key: string) => {
      setSelectedPreset(key);
      const preset = PRESETS[key];
      if (preset) {
          const newFaces = faces.map((f, i) => ({
              ...f,
              x: preset.coords[i].x,
              y: preset.coords[i].y
          }));
          setFaces(newFaces);
          setFoldProgress(0); // Reset animation
          setIsPlaying(false);
      }
  };

  // Step Controls
  const stepForward = () => {
      setIsPlaying(false);
      // Advance by one depth level roughly
      const stepSize = 1 / Math.max(1, maxDepth);
      setFoldProgress(p => Math.min(1, Math.round((p + stepSize) * maxDepth) / maxDepth));
  };

  const stepBackward = () => {
      setIsPlaying(false);
      const stepSize = 1 / Math.max(1, maxDepth);
      setFoldProgress(p => Math.max(0, Math.round((p - stepSize) * maxDepth) / maxDepth));
  };

  const togglePlay = () => {
      if (isPlaying) {
          setIsPlaying(false);
      } else {
          // If at end, rewind. If at start, play.
          if (foldProgress >= 1) {
              setAnimationDirection(-1);
          } else if (foldProgress <= 0) {
              setAnimationDirection(1);
          } else {
              // Resume in current direction? Or default to fold?
              // If previously unfolding, continue unfolding?
              // Let's just continue whatever direction we had or flip if stuck.
          }
          setIsPlaying(true);
      }
  };
  
  const resetFold = () => {
      setIsPlaying(false);
      setFoldProgress(0);
      setAnimationDirection(1);
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {/* Left Panel: 2D Editor */}
      <div className="w-1/2 flex flex-col border-r border-slate-700 bg-white">
        <header className="p-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center text-slate-900">
            <h1 className="text-xl font-bold flex items-center gap-2">
                <Layers className="text-blue-600" />
                Net Editor
            </h1>
            <div className="flex items-center gap-3">
                 {/* Preset Dropdown */}
                 <div className="relative group">
                    <button className="flex items-center gap-1 text-sm font-semibold text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50">
                        {PRESETS[selectedPreset]?.name || 'Custom'} <ChevronDown size={14}/>
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block z-20 max-h-80 overflow-y-auto">
                        {Object.entries(PRESETS).map(([key, val]) => (
                            <button 
                                key={key}
                                onClick={() => loadPreset(key)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                            >
                                {val.name}
                            </button>
                        ))}
                    </div>
                 </div>

                <button 
                    onClick={() => setShowHelp(!showHelp)}
                    className={`p-2 rounded-full transition-colors ${showHelp ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
                    title="Toggle Instructions"
                >
                    <Info size={20} />
                </button>
            </div>
        </header>
        
        <div className="flex-1 overflow-hidden p-4 bg-gray-100 relative">
            <NetEditor 
                faces={faces}
                setFaces={setFaces}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                onTextureUpdate={handleTextureUpdate}
                hoveredFaceId={hoveredFaceId}
                setHoveredFaceId={setHoveredFaceId}
                isValid={validity.isValid}
            />
            
            {/* Instruction Overlay */}
            {showHelp && (
                <div className="absolute bottom-6 right-6 max-w-sm bg-white/95 p-4 rounded-xl shadow-xl border border-gray-200 text-xs text-gray-600 backdrop-blur-sm z-30 transition-all animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-sm text-gray-800 flex items-center gap-2">
                            <Info size={16} className="text-blue-500"/> How to use
                        </p>
                        <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={16} />
                        </button>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                        <li>Drag blue slots to rearrange the net.</li>
                        <li>Draw on faces to see how they map.</li>
                        <li>Select <strong>Presets</strong> from top right.</li>
                        <li>Use playback controls to visualize folding.</li>
                    </ul>
                </div>
            )}
        </div>
      </div>

      {/* Right Panel: 3D View */}
      <div className="w-1/2 flex flex-col bg-slate-900 relative">
        <header className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shadow-lg z-10">
             <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <Box className="text-yellow-400" />
                3D Preview
            </h2>
             <div className="text-xs text-gray-400 font-mono">
                 {foldProgress === 0 ? 'FLAT' : foldProgress === 1 ? 'CUBE' : `${Math.round(foldProgress * 100)}%`}
             </div>
        </header>

        <div className="flex-1 relative cursor-move">
            <CubeView 
                faces={faces} 
                foldTree={foldTree}
                maxDepth={maxDepth}
                foldProgress={foldProgress}
                hoveredFaceId={hoveredFaceId}
                setHoveredFaceId={setHoveredFaceId}
                textureVersion={textureVersion}
            />
            
            {/* Playback Controls Overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur border border-slate-700 p-2 rounded-2xl flex flex-col gap-2 shadow-2xl w-80 z-20">
                {/* Progress Bar */}
                <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={foldProgress}
                    onChange={(e) => {
                        setIsPlaying(false);
                        setFoldProgress(parseFloat(e.target.value));
                    }}
                    className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                
                <div className="flex justify-center items-center gap-4 text-white">
                     <button onClick={resetFold} className="p-2 hover:bg-slate-700 rounded-full transition" title="Reset">
                         <RotateCcw size={18} />
                     </button>
                     <button onClick={stepBackward} className="p-2 hover:bg-slate-700 rounded-full transition" title="Step Back">
                         <StepBack size={20} />
                     </button>
                     
                     <button 
                        onClick={togglePlay}
                        disabled={!validity.isValid}
                        className={`p-3 rounded-full shadow-lg transition transform hover:scale-110 active:scale-95 flex items-center justify-center
                            ${isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-500'}
                            ${!validity.isValid ? 'opacity-50 cursor-not-allowed bg-gray-600' : ''}
                        `}
                     >
                        {isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor" className="ml-1"/>}
                     </button>

                     <button onClick={stepForward} className="p-2 hover:bg-slate-700 rounded-full transition" title="Step Forward">
                         <StepForward size={20} />
                     </button>
                     {/* Placeholder for symmetry */}
                     <div className="w-9"></div> 
                </div>
            </div>

            {/* Error Status */}
            <div className="absolute top-4 right-4 pointer-events-none">
                 {!validity.isValid && (
                     <div className="bg-red-500/90 text-white px-4 py-2 rounded shadow-lg backdrop-blur mb-2 font-bold animate-pulse">
                         Invalid Net Configuration
                     </div>
                 )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;