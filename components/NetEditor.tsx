import React, { useState, useMemo, useRef, createRef, useEffect } from 'react';
import { FaceData, DraggableFaceHandle, AdjacencyMap, EdgeSide } from '../types';
import { isConnected, GRID_SIZE, SIDE_COLORS } from '../utils';
import { DraggableFace } from './DraggableFace';
import { Paintbrush, Eraser, Move, Circle, Triangle, Minus, Hash, PaintBucket, Undo } from 'lucide-react';

interface Props {
  faces: FaceData[];
  setFaces: React.Dispatch<React.SetStateAction<FaceData[]>>;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  onTextureUpdate: (id: number) => void;
  hoveredFaceId: number | null;
  setHoveredFaceId: (id: number | null) => void;
  isValid: boolean;
  adjacencyMap: AdjacencyMap; // Prop for highligting
  showSharedEdges: boolean;
  showFaceIds: boolean;
}

export type ToolType = 'move' | 'brush' | 'line' | 'circle' | 'triangle';

export const NetEditor: React.FC<Props> = ({
  faces,
  setFaces,
  selectedId,
  setSelectedId,
  onTextureUpdate,
  hoveredFaceId,
  setHoveredFaceId,
  isValid,
  adjacencyMap,
  showSharedEdges,
  showFaceIds
}) => {
  const [drawingColor, setDrawingColor] = useState('#1e293b'); // slate-800
  const [activeTool, setActiveTool] = useState<ToolType>('move');

  // Responsive Cell Size
  const [cellSize, setCellSize] = useState(60);

  useEffect(() => {
    const handleResize = () => {
        // Mobile (md breakpoint is 768px)
        setCellSize(window.innerWidth < 768 ? 35 : 60);
    };

    // Initial call
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Refs for each face to call Undo
  const faceRefs = useRef<Map<number, React.RefObject<DraggableFaceHandle>>>(new Map());

  // Ensure we have refs for current faces
  if (faceRefs.current.size !== faces.length) {
      faces.forEach(f => {
          if (!faceRefs.current.has(f.id)) {
              faceRefs.current.set(f.id, createRef());
          }
      });
  }

  // Calculate potential move targets (ghost slots)
  const moveTargets = useMemo(() => {
    if (selectedId === null) return [];

    const remaining = faces.filter(f => f.id !== selectedId);
    if (remaining.length === 0) return [];

    const occupied = new Set(remaining.map(f => `${f.x},${f.y}`));
    const targets = new Set<string>();

    remaining.forEach(f => {
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        const nx = f.x + dx;
        const ny = f.y + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          if (!occupied.has(`${nx},${ny}`)) {
             targets.add(`${nx},${ny}`);
          }
        }
      });
    });

    return Array.from(targets).map(s => {
      const [x, y] = s.split(',').map(Number);
      return { x, y };
    });

  }, [faces, selectedId]);

  const handleGhostClick = (x: number, y: number) => {
    if (selectedId === null) return;
    setFaces(prev => prev.map(f =>
      f.id === selectedId ? { ...f, x, y } : f
    ));
  };

  const onFaceMove = (id: number, newX: number, newY: number): boolean => {
    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) return false;
    const targetOccupied = faces.some(f => f.id !== id && f.x === newX && f.y === newY);
    if (targetOccupied) return false;
    setFaces(prev => prev.map(f => f.id === id ? { ...f, x: newX, y: newY } : f));
    return true;
  };

  const getContext = (): CanvasRenderingContext2D | null => {
    if (selectedId === null) return null;
    const face = faces.find(f => f.id === selectedId);
    if (face?.canvasRef?.current) {
        return face.canvasRef.current.getContext('2d');
    }
    return null;
  };

  const handleClearCanvas = () => {
    const ctx = getContext();
    if (ctx && selectedId !== null) {
        const dpr = window.devicePixelRatio || 1;
        const logicalSize = ctx.canvas.width / dpr;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, logicalSize, logicalSize);
        onTextureUpdate(selectedId);
    }
  };

  const handleFill = () => {
    const ctx = getContext();
    if (ctx && selectedId !== null) {
        const dpr = window.devicePixelRatio || 1;
        const logicalSize = ctx.canvas.width / dpr;

        ctx.fillStyle = drawingColor;
        ctx.fillRect(0, 0, logicalSize, logicalSize);
        onTextureUpdate(selectedId);
    }
  };

  const handleHatch = () => {
    const ctx = getContext();
    if (ctx && selectedId !== null) {
        const dpr = window.devicePixelRatio || 1;
        const logicalSize = ctx.canvas.width / dpr;

        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = 16;
        ctx.beginPath();

        const step = 80;
        for(let i = -logicalSize; i < logicalSize * 2; i += step) {
            ctx.moveTo(i, 0);
            ctx.lineTo(i + logicalSize, logicalSize);
        }
        ctx.stroke();
        onTextureUpdate(selectedId);
    }
  };

  const handleUndo = () => {
    if (selectedId !== null) {
        faceRefs.current.get(selectedId)?.current?.undo();
    }
  };

  // Helper to determine what edges to highlight for a face
  const getHighlights = (faceId: number) => {
      if (selectedId === null) return undefined;
      const map = adjacencyMap[faceId];
      if (!map) return undefined;

      // Case 1: This is the selected face. Show all its connections.
      if (faceId === selectedId) {
          return map;
      }

      // Case 2: This is a neighbor. Check if it connects to the selected face.
      const filtered: typeof map = {};
      let hasMatch = false;
      for(const side of ['top', 'bottom', 'left', 'right'] as const) {
          const conn = map[side];
          if (conn && conn.targetFaceId === selectedId) {
              // We want the color of the SELECTED face's side (conn.targetSide)
              filtered[side] = {
                  ...conn,
                  color: SIDE_COLORS[conn.targetSide]
              };
              hasMatch = true;
          }
      }
      return hasMatch ? filtered : undefined;
  };

  // Helper to determine Vertex Labels (A,B,C,D / a,b,c,d)
  const getVertexLabels = (faceId: number): {[cornerIdx: number]: string} | undefined => {
      if (selectedId === null) return undefined;

      // 1. Selected Face: A, B, C, D at TL, TR, BR, BL
      if (faceId === selectedId) {
          return { 0: 'A', 1: 'B', 2: 'C', 3: 'D' };
      }

      // 2. Neighbor: Determine correspondence
      // We need to look at the Adjacency of the SELECTED face to see if this face connects to it.
      const selectedAdj = adjacencyMap[selectedId];
      if (!selectedAdj) return undefined;

      const labels: {[key: number]: string} = {};
      let hasLabel = false;

      // Check all 4 sides of the SELECTED face to see if they touch this faceId
      // Selected Top (A-B)
      if (selectedAdj.top?.targetFaceId === faceId) {
          const { targetSide, reversed } = selectedAdj.top;
          const [l1, l2] = reversed ? ['b', 'a'] : ['a', 'b'];
          applyLabels(targetSide, l1, l2, labels);
          hasLabel = true;
      }
      // Selected Right (B-C)
      if (selectedAdj.right?.targetFaceId === faceId) {
          const { targetSide, reversed } = selectedAdj.right;
          const [l1, l2] = reversed ? ['c', 'b'] : ['b', 'c'];
          applyLabels(targetSide, l1, l2, labels);
          hasLabel = true;
      }
      // Selected Bottom (C-D)
      if (selectedAdj.bottom?.targetFaceId === faceId) {
          const { targetSide, reversed } = selectedAdj.bottom;
          const [l1, l2] = reversed ? ['d', 'c'] : ['c', 'd'];
          applyLabels(targetSide, l1, l2, labels);
          hasLabel = true;
      }
      // Selected Left (D-A)
      if (selectedAdj.left?.targetFaceId === faceId) {
          const { targetSide, reversed } = selectedAdj.left;
          const [l1, l2] = reversed ? ['a', 'd'] : ['d', 'a'];
          applyLabels(targetSide, l1, l2, labels);
          hasLabel = true;
      }

      return hasLabel ? labels : undefined;
  };

  // Maps a side (top/right/bottom/left) to its vertex indices
  // Top: 0-1, Right: 1-2, Bottom: 2-3, Left: 3-0
  const applyLabels = (side: EdgeSide, startLabel: string, endLabel: string, labels: any) => {
      switch(side) {
          case 'top': labels[0] = startLabel; labels[1] = endLabel; break;
          case 'right': labels[1] = startLabel; labels[2] = endLabel; break;
          case 'bottom': labels[2] = startLabel; labels[3] = endLabel; break;
          case 'left': labels[3] = startLabel; labels[0] = endLabel; break;
      }
  };

  return (
    <div className="flex flex-col items-center gap-4 bg-[#F5F5F7] p-3 sm:p-4 rounded-3xl shadow-inner h-full w-full relative">

      {/* Toolbar - Responsive horizontal scroll */}
      <div className="flex flex-col gap-3 bg-white p-3 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] w-full max-w-full z-10 shrink-0">
         {/* Colors */}
         <div className="flex justify-center gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
            {['#1e293b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'].map(c => (
                <button
                    key={c}
                    onClick={() => setDrawingColor(c)}
                    className={`w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all duration-200 ${drawingColor === c ? 'border-black scale-110 shadow-[0_4px_12px_rgba(0,0,0,0.15)]' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                />
            ))}
         </div>

         {/* Tools */}
         <div className="flex justify-center gap-1.5 flex-wrap sm:flex-nowrap overflow-x-auto no-scrollbar">
             <button
                onClick={() => setActiveTool('move')}
                className={`px-3 py-2 rounded-lg flex-shrink-0 transition-all duration-200 ${activeTool === 'move' ? 'bg-[#007AFF] text-white shadow-[0_4px_14px_rgba(0,122,255,0.3)]' : 'hover:bg-gray-50 text-[#86868B]'}`}
                title="移动面"
             >
                <Move size={16} />
             </button>

             <div className="w-px bg-gray-100 h-6 mx-1 hidden sm:block"></div>

             <button
                onClick={() => setActiveTool('brush')}
                className={`px-3 py-2 rounded-lg flex-shrink-0 transition-all duration-200 ${activeTool === 'brush' ? 'bg-[#007AFF] text-white shadow-[0_4px_14px_rgba(0,122,255,0.3)]' : 'hover:bg-gray-50 text-[#86868B]'}`}
                title="画笔"
             >
                <Paintbrush size={16} />
             </button>
             <button
                onClick={() => setActiveTool('line')}
                className={`px-3 py-2 rounded-lg flex-shrink-0 transition-all duration-200 ${activeTool === 'line' ? 'bg-[#007AFF] text-white shadow-[0_4px_14px_rgba(0,122,255,0.3)]' : 'hover:bg-gray-50 text-[#86868B]'}`}
                title="直线"
             >
                <Minus size={16} className="-rotate-45" />
             </button>
             <button
                onClick={() => setActiveTool('circle')}
                className={`px-3 py-2 rounded-lg flex-shrink-0 transition-all duration-200 ${activeTool === 'circle' ? 'bg-[#007AFF] text-white shadow-[0_4px_14px_rgba(0,122,255,0.3)]' : 'hover:bg-gray-50 text-[#86868B]'}`}
                title="圆形"
             >
                <Circle size={16} />
             </button>
             <button
                onClick={() => setActiveTool('triangle')}
                className={`px-3 py-2 rounded-lg flex-shrink-0 transition-all duration-200 ${activeTool === 'triangle' ? 'bg-[#007AFF] text-white shadow-[0_4px_14px_rgba(0,122,255,0.3)]' : 'hover:bg-gray-50 text-[#86868B]'}`}
                title="三角形"
             >
                <Triangle size={16} />
             </button>

             <div className="w-px bg-gray-100 h-6 mx-1 hidden sm:block"></div>

             <button
                onClick={handleHatch}
                disabled={selectedId === null}
                className="px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-[#86868B] flex-shrink-0 transition-colors duration-200"
                title="斜线填充"
             >
                <Hash size={16} />
             </button>
             <button
                onClick={handleFill}
                disabled={selectedId === null}
                className="px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-[#86868B] flex-shrink-0 transition-colors duration-200"
                title="实色填充"
             >
                <PaintBucket size={16} />
             </button>
             <div className="w-px bg-gray-100 h-6 mx-1 hidden sm:block"></div>
             <button
                onClick={handleUndo}
                disabled={selectedId === null}
                className="px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-[#86868B] flex-shrink-0 transition-colors duration-200"
                title="撤销上一步"
             >
                <Undo size={16} />
             </button>
             <button
                onClick={handleClearCanvas}
                disabled={selectedId === null}
                className="px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed text-[#FF453A] flex-shrink-0 transition-colors duration-200"
                title="清空画布"
             >
                <Eraser size={16} />
             </button>
         </div>
      </div>

      <div className="text-sm text-[#86868B] mb-2 flex items-center gap-2 flex-wrap justify-center shrink-0">
         {!isValid && <span className="text-[#FF453A] font-semibold">无效形状</span>}
         {isValid && <span className="text-[#30D158] font-medium">有效展开图</span>}
         <span className="text-xs text-gray-400">| {activeTool === 'move' ? '拖动方块进行移动' : '选择方块进行绘制'}</span>
      </div>

      {/* Grid Container - Centered without clipping */}
      <div className="flex-1 w-full overflow-auto flex justify-center min-h-0 relative">
        <div
            className="relative bg-white border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-2xl touch-none flex-shrink-0 my-auto m-2"
            style={{ width: GRID_SIZE * cellSize, height: GRID_SIZE * cellSize }}
        >
            {/* Grid Background Lines */}
            <div
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                    backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                    backgroundSize: `${cellSize}px ${cellSize}px`
                }}
            />

            {/* Faces */}
            {faces.map(face => (
                <DraggableFace
                    key={face.id}
                    ref={faceRefs.current.get(face.id) as any}
                    data={face}
                    isSelected={selectedId === face.id}
                    onSelect={setSelectedId}
                    gridSize={cellSize}
                    onDrawUpdate={onTextureUpdate}
                    isHoveredBy3D={hoveredFaceId === face.id}
                    onHover={setHoveredFaceId}
                    drawingColor={drawingColor}
                    activeTool={activeTool}
                    onMoveFace={onFaceMove}
                    highlightEdges={getHighlights(face.id)}
                    vertexLabels={getVertexLabels(face.id)}
                    showSharedEdges={showSharedEdges}
                    showFaceIds={showFaceIds}
                />
            ))}

            {/* Move Targets (Ghost Slots) */}
            {activeTool === 'move' && moveTargets.map(t => (
                <div
                    key={`target-${t.x}-${t.y}`}
                    onClick={() => handleGhostClick(t.x, t.y)}
                    className="absolute border-2 border-dashed border-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 cursor-pointer flex items-center justify-center text-[#007AFF] transition-colors duration-200 z-0"
                    style={{
                        width: cellSize - 4,
                        height: cellSize - 4,
                        left: t.x * cellSize + 2,
                        top: t.y * cellSize + 2
                    }}
                >
                    <Move size={24} className="opacity-50" />
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
