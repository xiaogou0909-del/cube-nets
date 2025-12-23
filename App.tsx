import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NetEditor } from './components/NetEditor';
import { CubeView } from './components/CubeView';
import { FaceData, FaceNode, AdjacencyMap } from './types';
import { checkGeometricValidity, GRID_SIZE, buildFoldTree, PRESETS, calculateAdjacency } from './utils';
import { Box, Layers, Info, X, ChevronDown, PackageOpen, Package, Hash, Link as LinkIcon } from 'lucide-react';

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
  
  // Visibility Toggles
  const [showSharedEdges, setShowSharedEdges] = useState(true);
  const [showFaceIds, setShowFaceIds] = useState(true);

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

  // Computed Tree & Depth & Adjacency
  const { foldTree, maxDepth, adjacencyMap } = useMemo(() => {
      const tree = buildFoldTree(faces);
      let depth = 0;
      if (tree) {
          const q = [{node: tree, d: 0}];
          while(q.length > 0) {
              const {node, d} = q.shift()!;
              depth = Math.max(depth, d);
              node.children.forEach(c => q.push({node: c, d: d+1}));
          }
      }
      // Only calculate 3D adjacency if valid
      const adj: AdjacencyMap = (validity.isValid) ? calculateAdjacency(faces) : {};

      return { foldTree: tree, maxDepth: depth || 1, adjacencyMap: adj };
  }, [faces, validity.isValid]);

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

  const handleFold = () => {
      if (!validity.isValid) return;
      // If already folded (or close to it), reset to flat to replay animation
      if (foldProgress >= 0.99) {
          setFoldProgress(0);
      }
      setAnimationDirection(1);
      setIsPlaying(true);
  };

  const handleUnfold = () => {
      // If already flat (or close to it), reset to folded to replay animation
      if (foldProgress <= 0.01) {
          setFoldProgress(1);
      }
      setAnimationDirection(-1);
      setIsPlaying(true);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {/* Left Panel: 2D Editor */}
      <div className="h-1/2 md:h-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-slate-700 bg-white order-2 md:order-1">
        <header className="p-3 md:p-4 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center text-slate-900 shrink-0 gap-2">
            <div className="flex items-center gap-4">
                <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
                    <Layers className="text-blue-600" />
                    展开图编辑
                </h1>
                
                {/* Toggles */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSharedEdges(!showSharedEdges)}
                        className={`p-1.5 rounded-md border flex items-center gap-1 text-xs font-semibold transition-colors ${showSharedEdges ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
                        title="切换公共边高亮"
                    >
                        <LinkIcon size={14} />
                        <span className="hidden sm:inline">公共边</span>
                    </button>
                    <button
                        onClick={() => setShowFaceIds(!showFaceIds)}
                        className={`p-1.5 rounded-md border flex items-center gap-1 text-xs font-semibold transition-colors ${showFaceIds ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
                        title="切换面编号"
                    >
                        <Hash size={14} />
                        <span className="hidden sm:inline">编号</span>
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
                 {/* Preset Dropdown */}
                 <div className="relative group">
                    <button className="flex items-center gap-1 text-sm font-semibold text-gray-700 bg-white border border-gray-300 px-2 py-1 md:px-3 md:py-1.5 rounded-md hover:bg-gray-50">
                        <span className="hidden sm:inline">{PRESETS[selectedPreset]?.name}</span>
                        <span className="sm:hidden">预设</span>
                        <ChevronDown size={14}/>
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block z-20 max-h-60 md:max-h-80 overflow-y-auto">
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
                    className={`p-1.5 md:p-2 rounded-full transition-colors ${showHelp ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
                    title="显示/隐藏说明"
                >
                    <Info size={20} />
                </button>
            </div>
        </header>
        
        <div className="flex-1 overflow-hidden p-0 md:p-2 bg-gray-100 relative">
            <NetEditor 
                faces={faces}
                setFaces={setFaces}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                onTextureUpdate={handleTextureUpdate}
                hoveredFaceId={hoveredFaceId}
                setHoveredFaceId={setHoveredFaceId}
                isValid={validity.isValid}
                adjacencyMap={adjacencyMap}
                showSharedEdges={showSharedEdges}
                showFaceIds={showFaceIds}
            />
            
            {/* Instruction Overlay */}
            {showHelp && (
                <div className="absolute bottom-4 right-4 max-w-xs bg-white/95 p-3 rounded-xl shadow-xl border border-gray-200 text-xs text-gray-600 backdrop-blur-sm z-30 transition-all pointer-events-auto">
                    <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-gray-800 flex items-center gap-2">
                            <Info size={14} className="text-blue-500"/> 使用指南
                        </p>
                        <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600 p-1">
                            <X size={16} />
                        </button>
                    </div>
                    <ul className="list-disc list-inside space-y-1 ml-1">
                        <li>拖动方块到蓝色虚线框以移动位置。</li>
                        <li>在面上绘画以观察方向变化。</li>
                        <li>使用顶部按钮切换公共边和编号显示。</li>
                    </ul>
                </div>
            )}
        </div>
      </div>

      {/* Right Panel: 3D View */}
      <div className="h-1/2 md:h-full md:w-1/2 flex flex-col bg-slate-900 relative order-1 md:order-2">
        <header className="p-3 md:p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shadow-lg z-10 shrink-0">
             <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-white">
                <Box className="text-yellow-400" />
                3D 预览
            </h2>
             <div className="text-xs text-gray-400 font-mono">
                 {foldProgress === 0 ? '展开' : foldProgress === 1 ? '折叠' : `${Math.round(foldProgress * 100)}%`}
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
                selectedId={selectedId}
                adjacencyMap={adjacencyMap}
                showSharedEdges={showSharedEdges}
                showFaceIds={showFaceIds}
            />
            
            {/* Simple Buttons Overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-6 z-20">
                 <button 
                    onClick={handleFold}
                    disabled={!validity.isValid}
                    className={`
                        flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95
                        ${!validity.isValid ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50' : 'bg-blue-600 text-white hover:bg-blue-500'}
                    `}
                 >
                     <Package size={20} />
                     折叠
                 </button>

                 <button 
                    onClick={handleUnfold}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 bg-slate-700 text-white hover:bg-slate-600"
                 >
                     <PackageOpen size={20} />
                     展开
                 </button>
            </div>

            {/* Error Status */}
            <div className="absolute top-4 right-4 pointer-events-none w-full flex justify-end px-4">
                 {!validity.isValid && (
                     <div className="bg-red-500/90 text-white px-3 py-1 md:px-4 md:py-2 text-xs md:text-sm rounded shadow-lg backdrop-blur mb-2 font-bold animate-pulse text-center">
                         无效展开图
                     </div>
                 )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;