import React, { useState, useMemo } from 'react';
import { FaceData } from '../types';
import { isConnected, GRID_SIZE } from '../utils';
import { DraggableFace } from './DraggableFace';
import { Paintbrush, Eraser, Move, Circle, Triangle, Minus, Hash, PaintBucket } from 'lucide-react';

interface Props {
  faces: FaceData[];
  setFaces: React.Dispatch<React.SetStateAction<FaceData[]>>;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  onTextureUpdate: (id: number) => void;
  hoveredFaceId: number | null;
  setHoveredFaceId: (id: number | null) => void;
  isValid: boolean;
}

export type ToolType = 'brush' | 'line' | 'circle' | 'triangle';

export const NetEditor: React.FC<Props> = ({
  faces,
  setFaces,
  selectedId,
  setSelectedId,
  onTextureUpdate,
  hoveredFaceId,
  setHoveredFaceId,
  isValid
}) => {
  const [drawingColor, setDrawingColor] = useState('#1e293b'); // slate-800
  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const CELL_SIZE = 80; // Pixels per cell

  // Calculate potential move targets
  const moveTargets = useMemo(() => {
    if (selectedId === null) return [];
    
    // Logic: Remove selected face, check valid empty spots adjacent to remaining group
    // that would keep the group connected.
    
    // 1. Temporarily remove selected
    const remaining = faces.filter(f => f.id !== selectedId);
    if (remaining.length === 0) return []; // Should not happen with 6 faces

    // 2. Find all empty adjacent cells to the remaining group
    const occupied = new Set(remaining.map(f => `${f.x},${f.y}`));
    const targets = new Set<string>();

    remaining.forEach(f => {
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        const nx = f.x + dx;
        const ny = f.y + dy;
        // Bounds check
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          if (!occupied.has(`${nx},${ny}`)) {
             targets.add(`${nx},${ny}`);
          }
        }
      });
    });

    // 3. For each target, check if placing selected there keeps whole connected
    // (Actually, by definition, if we attach to the main group, it is connected)
    return Array.from(targets).map(s => {
      const [x, y] = s.split(',').map(Number);
      return { x, y };
    });

  }, [faces, selectedId]);

  const handleMove = (x: number, y: number) => {
    if (selectedId === null) return;
    setFaces(prev => prev.map(f => 
      f.id === selectedId ? { ...f, x, y } : f
    ));
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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // Re-draw label
        ctx.font = "bold 60px Arial";
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(selectedId.toString(), ctx.canvas.width/2, ctx.canvas.height/2);
        onTextureUpdate(selectedId);
    }
  };

  const handleFill = () => {
    const ctx = getContext();
    if (ctx && selectedId !== null) {
        ctx.fillStyle = drawingColor;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        onTextureUpdate(selectedId);
    }
  };

  const handleHatch = () => {
    const ctx = getContext();
    if (ctx && selectedId !== null) {
        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const step = 20;
        for(let i = -h; i < w; i += step) {
            ctx.moveTo(i, 0);
            ctx.lineTo(i + h, h);
        }
        ctx.stroke();
        onTextureUpdate(selectedId);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 bg-gray-50 p-4 rounded-xl shadow-inner h-full overflow-y-auto">
      
      {/* Drawing Toolbar */}
      <div className="flex flex-col gap-2 bg-white p-2 rounded-lg shadow-sm w-full">
         {/* Colors */}
         <div className="flex justify-center gap-1 mb-2">
            {['#1e293b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'].map(c => (
                <button
                    key={c}
                    onClick={() => setDrawingColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${drawingColor === c ? 'border-black scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                />
            ))}
         </div>
         
         {/* Tools */}
         <div className="flex justify-center gap-2 flex-wrap">
             <button 
                onClick={() => setActiveTool('brush')}
                className={`p-2 rounded ${activeTool === 'brush' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                title="Brush"
             >
                <Paintbrush size={18} />
             </button>
             <button 
                onClick={() => setActiveTool('line')}
                className={`p-2 rounded ${activeTool === 'line' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                title="Line"
             >
                <Minus size={18} className="-rotate-45" />
             </button>
             <button 
                onClick={() => setActiveTool('circle')}
                className={`p-2 rounded ${activeTool === 'circle' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                title="Circle"
             >
                <Circle size={18} />
             </button>
             <button 
                onClick={() => setActiveTool('triangle')}
                className={`p-2 rounded ${activeTool === 'triangle' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                title="Triangle"
             >
                <Triangle size={18} />
             </button>
             
             <div className="w-px bg-gray-200 h-8 mx-1"></div>

             <button 
                onClick={handleHatch}
                disabled={selectedId === null}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
                title="Diagonal Hatch"
             >
                <Hash size={18} />
             </button>
             <button 
                onClick={handleFill}
                disabled={selectedId === null}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700"
                title="Solid Fill"
             >
                <PaintBucket size={18} />
             </button>
             <button 
                onClick={handleClearCanvas}
                disabled={selectedId === null}
                className="p-2 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed text-red-500"
                title="Clear Face"
             >
                <Eraser size={18} />
             </button>
         </div>
      </div>

      <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
         {!isValid && <span className="text-red-500 font-bold">Invalid Shape</span>}
         {isValid && <span className="text-green-600 font-medium">Valid Net</span>}
         <span className="text-xs text-gray-400">| Select square to Edit</span>
      </div>

      {/* Grid Container */}
      <div 
        className="relative bg-white border border-gray-200 shadow-sm rounded"
        style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE }}
      >
        {/* Grid Background Lines */}
        <div 
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
                backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`
            }}
        />

        {/* Faces */}
        {faces.map(face => (
            <DraggableFace
                key={face.id}
                data={face}
                isSelected={selectedId === face.id}
                onSelect={setSelectedId}
                gridSize={CELL_SIZE}
                onDrawUpdate={onTextureUpdate}
                isHoveredBy3D={hoveredFaceId === face.id}
                onHover={setHoveredFaceId}
                drawingColor={drawingColor}
                activeTool={activeTool}
            />
        ))}

        {/* Move Targets (Ghost Slots) */}
        {moveTargets.map(t => (
            <div
                key={`target-${t.x}-${t.y}`}
                onClick={() => handleMove(t.x, t.y)}
                className="absolute border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100 cursor-pointer flex items-center justify-center text-blue-400 transition-colors z-0"
                style={{
                    width: CELL_SIZE - 4,
                    height: CELL_SIZE - 4,
                    left: t.x * CELL_SIZE + 2,
                    top: t.y * CELL_SIZE + 2
                }}
            >
                <Move size={24} className="opacity-50" />
            </div>
        ))}
      </div>
    </div>
  );
};