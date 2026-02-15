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
  const [targetProgress, setTargetProgress] = useState(0); // 0 (flat) or 1 (cube)

  // Version counter to trigger texture updates in 3D
  const [textureVersion, setTextureVersion] = useState(0);

  // Validation
  const [validity, setValidity] = useState({ isValid: true, message: '' });

  // UI State
  const [showHelp, setShowHelp] = useState(true);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [showSharedEdges, setShowSharedEdges] = useState(false);
  const [showFaceIds, setShowFaceIds] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.querySelector('.preset-dropdown-container');
      const button = document.querySelector('.preset-dropdown-button');

      if (dropdown && button &&
          !dropdown.contains(event.target as Node) &&
          !button.contains(event.target as Node)) {
        setShowPresetDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Animation Frame
  // Removed manual animation loop, handled in CubeView now

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
          setTargetProgress(0);
      }
  };

  const handleFold = () => {
      if (!validity.isValid) return;
      setTargetProgress(1);
  };

  const handleUnfold = () => {
      setTargetProgress(0);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#F5F5F7] text-[#1D1D1F] overflow-hidden font-sans">

      {/* Left Panel: 2D Editor */}
      <div className="h-1/2 md:h-full md:w-1/2 flex flex-col bg-[#FFFFFF] order-2 md:order-1 rounded-3xl md:rounded-r-none md:border-r border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mx-2 md:mx-0 my-2 md:my-0">
        <header className="p-4 md:p-6 bg-[#F5F5F7] border-b border-gray-100 flex flex-wrap justify-between items-center text-[#1D1D1F] shrink-0 gap-3 rounded-t-3xl">
            <div className="flex items-center gap-4">
                <h1 className="text-lg md:text-xl font-semibold flex items-center gap-2">
                    <Layers className="text-[#007AFF]" />
                    展开图编辑
                </h1>

                {/* Toggles */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSharedEdges(!showSharedEdges)}
                        className={`px-3 py-1.5 rounded-full border flex items-center gap-1 text-xs font-medium transition-all duration-200 ${showSharedEdges ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-[0_4px_14px_rgba(0,122,255,0.3)]' : 'bg-white border-gray-200 text-[#86868B] hover:bg-gray-50'}`}
                        title="切换公共边高亮"
                    >
                        <LinkIcon size={14} />
                        <span className="hidden sm:inline">公共边</span>
                    </button>
                    <button
                        onClick={() => setShowFaceIds(!showFaceIds)}
                        className={`px-3 py-1.5 rounded-full border flex items-center gap-1 text-xs font-medium transition-all duration-200 ${showFaceIds ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-[0_4px_14px_rgba(0,122,255,0.3)]' : 'bg-white border-gray-200 text-[#86868B] hover:bg-gray-50'}`}
                        title="切换面编号"
                    >
                        <Hash size={14} />
                        <span className="hidden sm:inline">编号</span>
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
                 {/* Preset Dropdown */}
                 <div className="relative preset-dropdown-container">
                    <button
                        onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                        className="preset-dropdown-button flex items-center gap-1 text-sm font-medium text-[#86868B] bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-all duration-200"
                    >
                        <span className="hidden sm:inline">{PRESETS[selectedPreset]?.name}</span>
                        <span className="sm:hidden">预设</span>
                        <ChevronDown size={14} className={`transition-transform duration-200 ${showPresetDropdown ? 'rotate-180' : ''}`}/>
                    </button>
                    <div
                        className={`absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] z-50 max-h-60 md:max-h-80 overflow-y-auto transition-all duration-200 ${showPresetDropdown ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                        onMouseLeave={() => setShowPresetDropdown(false)}
                    >
                        {Object.entries(PRESETS).map(([key, val]) => (
                            <button
                                key={key}
                                onClick={() => {
                                    loadPreset(key);
                                    setShowPresetDropdown(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors duration-200"
                            >
                                {val.name}
                            </button>
                        ))}
                    </div>
                 </div>

                <button
                    onClick={() => setShowHelp(!showHelp)}
                    className={`p-2 rounded-full transition-all duration-200 ${showHelp ? 'bg-[#007AFF] text-white shadow-[0_4px_14px_rgba(0,122,255,0.3)]' : 'hover:bg-gray-100 text-[#86868B]'}`}
                    title="显示/隐藏说明"
                >
                    <Info size={20} />
                </button>
            </div>
        </header>

        <div className="flex-1 overflow-hidden p-0 md:p-6 bg-[#F5F5F7] relative">
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
                <div className="absolute bottom-6 right-6 max-w-xs bg-white/95 p-5 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-gray-100 text-xs text-[#86868B] backdrop-blur-md z-30 transition-all duration-300 pointer-events-auto">
                    <div className="flex justify-between items-start mb-3">
                        <p className="font-semibold text-[#1D1D1F] flex items-center gap-2">
                            <Info size={14} className="text-[#007AFF]"/> 使用指南
                        </p>
                        <button onClick={() => setShowHelp(false)} className="text-[#86868B] hover:text-[#1D1D1F] p-1 transition-colors">
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
      <div className="h-1/2 md:h-full md:w-1/2 flex flex-col bg-[#1C1C1E] relative order-1 md:order-2 rounded-3xl md:rounded-l-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] mx-2 md:mx-0 my-2 md:my-0">
        <header className="p-4 md:p-6 bg-[#2C2C2E] border-b border-gray-700 flex justify-between items-center z-10 shrink-0 rounded-t-3xl">
             <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2 text-white">
                <Box className="text-[#0A84FF]" />
                3D 预览
            </h2>
             <div className="text-xs text-[#86868B] font-mono">
                 {targetProgress === 0 ? '展开' : '折叠'}
             </div>
        </header>

        <div className="flex-1 relative cursor-move">
            <CubeView
                faces={faces}
                foldTree={foldTree}
                maxDepth={maxDepth}
                targetProgress={targetProgress}
                hoveredFaceId={hoveredFaceId}
                setHoveredFaceId={setHoveredFaceId}
                textureVersion={textureVersion}
                selectedId={selectedId}
                adjacencyMap={adjacencyMap}
                showSharedEdges={showSharedEdges}
                showFaceIds={showFaceIds}
            />

            {/* Simple Buttons Overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-20">
                 <button
                    onClick={handleFold}
                    disabled={!validity.isValid}
                    className={`
                        flex items-center gap-2 px-8 py-4 rounded-full font-semibold shadow-[0_8px_20px_rgba(0,122,255,0.25)] transition-all duration-300 ${!validity.isValid ? 'bg-[#48484A] text-[#86868B] cursor-not-allowed opacity-60' : 'bg-[#007AFF] text-white hover:bg-[#409CFF] hover:shadow-[0_12px_30px_rgba(0,122,255,0.4)] hover:scale-105'}`}
                 >
                     <Package size={20} />
                     折叠
                 </button>

                 <button
                    onClick={handleUnfold}
                    className="flex items-center gap-2 px-8 py-4 rounded-full font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.25)] transition-all duration-300 bg-[#48484A] text-white hover:bg-[#636366] hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)] hover:scale-105"
                 >
                     <PackageOpen size={20} />
                     展开
                 </button>
            </div>

            {/* Error Status */}
            <div className="absolute top-6 right-6 pointer-events-none w-full flex justify-end px-6">
                 {!validity.isValid && (
                     <div className="bg-[#FF453A]/90 text-white px-4 py-2 text-sm rounded-xl shadow-[0_8px_20px_rgba(255,69,58,0.3)] backdrop-blur-md mb-2 font-semibold text-center">
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
