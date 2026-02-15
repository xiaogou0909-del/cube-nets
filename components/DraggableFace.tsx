import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { FaceData, DraggableFaceHandle, EdgeConnection, EdgeSide } from '../types';
import { ToolType } from './NetEditor';

interface Props {
  data: FaceData;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onDrawUpdate: (id: number) => void;
  isHoveredBy3D: boolean;
  onHover: (id: number | null) => void;
  gridSize: number; // pixel size of grid cell
  drawingColor: string;
  activeTool: ToolType;
  onMoveFace: (id: number, x: number, y: number) => boolean;
  highlightEdges?: {[key in EdgeSide]?: EdgeConnection}; // Adjacency highlights
  vertexLabels?: {[cornerIndex: number]: string}; // 0=TL, 1=TR, 2=BR, 3=BL
  showSharedEdges: boolean;
  showFaceIds: boolean;
}

const TEXTURE_SIZE = 1024; // High resolution for sharp 3D texturing

export const DraggableFace = forwardRef<DraggableFaceHandle, Props>(({
  data, isSelected, onSelect, onDrawUpdate, isHoveredBy3D, onHover, gridSize, drawingColor, activeTool, onMoveFace, highlightEdges, vertexLabels, showSharedEdges, showFaceIds
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const startPosRef = useRef<{x: number, y: number}>({x: 0, y: 0});

  // History for Undo
  const historyRef = useRef<ImageData[]>([]);

  // Drawing State
  const [isDrawing, setIsDrawing] = useState(false);

  // Dragging State (Position)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number, clientY: number, startLeft: number, startTop: number }>({ clientX: 0, clientY: 0, startLeft: 0, startTop: 0 });

  // Visual position in pixels (relative to container)
  const [visualPos, setVisualPos] = useState({ x: data.x * gridSize + 2, y: data.y * gridSize + 2 });

  // Sync prop position to visual position when not dragging
  useEffect(() => {
    if (!isDragging) {
      setVisualPos({
        x: data.x * gridSize + 2,
        y: data.y * gridSize + 2
      });
    }
  }, [data.x, data.y, gridSize, isDragging]);

  // Sync ref back to parent data for 3D usage
  useEffect(() => {
    if (data.canvasRef && canvasRef.current) {
      data.canvasRef.current = canvasRef.current;
    }
  }, [data]);

  // Init Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const size = TEXTURE_SIZE;

    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Initial state for undo
        const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        historyRef.current = [initialData];

        contextRef.current = ctx;
        onDrawUpdate(data.id);
      }
    }
  }, []);

  // Ensure history is always properly initialized
  useEffect(() => {
    if (contextRef.current && canvasRef.current && historyRef.current.length === 0) {
      const initialData = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      historyRef.current = [initialData];
    }
  }, [contextRef.current, canvasRef.current]);

  // Expose methods via Ref
  useImperativeHandle(ref, () => ({
    undo: () => {
      const ctx = contextRef.current;
      const canvas = canvasRef.current;

      if (!ctx || !canvas || historyRef.current.length <= 1) {
        console.log('Undo not available:', !ctx, !canvas, historyRef.current.length);
        return;
      }

      historyRef.current.pop(); // Remove current state
      const previousState = historyRef.current[historyRef.current.length - 1];
      ctx.putImageData(previousState, 0, 0);
      onDrawUpdate(data.id);
    },
    saveHistory: () => {
      saveHistory();
    }
  }));

  const saveHistory = () => {
     const ctx = contextRef.current;
     const canvas = canvasRef.current;

     if (!ctx || !canvas) return;

     // Ensure we save history at the beginning of each draw
     if (historyRef.current.length === 0) {
        const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        historyRef.current = [initialData];
     }

     // Limit history size
     if (historyRef.current.length > 20) historyRef.current.shift();
     historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  // --- Handlers ---

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);

    if (activeTool === 'move') {
      // 选中面以显示公共边高亮
      onSelect(data.id);
      setIsDragging(true);
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startLeft: visualPos.x,
        startTop: visualPos.y
      };
    } else {
      startDrawing(e);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      setVisualPos({
        x: dragStartRef.current.startLeft + dx,
        y: dragStartRef.current.startTop + dy
      });
    } else {
      draw(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as Element).releasePointerCapture(e.pointerId);

    if (isDragging) {
      setIsDragging(false);
      const centerX = visualPos.x + (gridSize - 4) / 2;
      const centerY = visualPos.y + (gridSize - 4) / 2;
      const gridX = Math.floor(centerX / gridSize);
      const gridY = Math.floor(centerY / gridSize);

      const success = onMoveFace(data.id, gridX, gridY);
      if (!success) {
        setVisualPos({
            x: data.x * gridSize + 2,
            y: data.y * gridSize + 2
        });
      }
    } else {
      stopDrawing();
    }
  };


  // --- Drawing Logic ---

  const startDrawing = (e: React.PointerEvent) => {
    if (!isSelected) {
        onSelect(data.id);
    }

    const { offsetX, offsetY } = getOffset(e);

    if(contextRef.current && canvasRef.current) {
        setIsDrawing(true);
        startPosRef.current = { x: offsetX, y: offsetY };

        contextRef.current.strokeStyle = drawingColor;
        contextRef.current.fillStyle = drawingColor;
        contextRef.current.lineWidth = 16;

        // Save history before any changes
        saveHistory();

        if (activeTool === 'brush') {
            contextRef.current.beginPath();
            contextRef.current.moveTo(offsetX, offsetY);
        } else {
            const canvas = canvasRef.current;
            snapshotRef.current = contextRef.current.getImageData(0, 0, canvas.width, canvas.height);
        }
    }
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing || !contextRef.current) return;
    const { offsetX, offsetY } = getOffset(e);
    const startX = startPosRef.current.x;
    const startY = startPosRef.current.y;

    if (activeTool === 'brush') {
        contextRef.current.lineTo(offsetX, offsetY);
        contextRef.current.stroke();
    } else {
        if (snapshotRef.current) {
            contextRef.current.putImageData(snapshotRef.current, 0, 0);
        }

        contextRef.current.beginPath();
        if (activeTool === 'line') {
            contextRef.current.moveTo(startX, startY);
            contextRef.current.lineTo(offsetX, offsetY);
            contextRef.current.stroke();
        } else if (activeTool === 'circle') {
            const radius = Math.sqrt(Math.pow(offsetX - startX, 2) + Math.pow(offsetY - startY, 2));
            contextRef.current.arc(startX, startY, radius, 0, 2 * Math.PI);
            contextRef.current.stroke();
        } else if (activeTool === 'triangle') {
            const topX = startX + (offsetX - startX) / 2;
            const topY = startY;
            const botLeftX = startX;
            const botLeftY = offsetY;
            const botRightX = offsetX;
            const botRightY = offsetY;
            contextRef.current.moveTo(topX, topY);
            contextRef.current.lineTo(botRightX, botRightY);
            contextRef.current.lineTo(botLeftX, botLeftY);
            contextRef.current.closePath();
            contextRef.current.stroke();
        }
    }
  };

  const stopDrawing = () => {
    if(isDrawing) {
        contextRef.current?.closePath();
        setIsDrawing(false);
        snapshotRef.current = null;
        saveHistory();
        onDrawUpdate(data.id);
    }
  };

  const getOffset = (evt: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { offsetX: 0, offsetY: 0 };

      const rect = canvas.getBoundingClientRect();
      const clientX = evt.clientX;
      const clientY = evt.clientY;

      const x = (clientX - rect.left) / rect.width * TEXTURE_SIZE;
      const y = (clientY - rect.top) / rect.height * TEXTURE_SIZE;
      return { offsetX: x, offsetY: y };
  };

  // Helper for rendering vertex label
  const renderVertexLabel = (idx: number, posClass: string) => {
      if (!vertexLabels || !vertexLabels[idx]) return null;

      // Determine badge size based on grid size
      const badgeClass = gridSize < 50
        ? "w-4 h-4 text-[8px]"
        : "w-5 h-5 text-[10px]";

      return (
          <div className={`absolute ${posClass} pointer-events-none z-50 flex items-center justify-center`}>
              <div className={`${badgeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm border border-white/30`}>
                  {vertexLabels[idx]}
              </div>
          </div>
      );
  };

  return (
    <div
      className={`absolute transition-all ease-out bg-white select-none touch-none box-border
        ${isSelected ? 'shadow-[0_20px_60px_rgba(0,0,0,0.1)] z-30' : 'shadow-[0_4px_12px_rgba(0,0,0,0.03)] z-10'}
        ${isHoveredBy3D ? 'ring-4 ring-[#0A84FF] ring-opacity-60' : ''}
        ${isDragging ? 'cursor-grabbing scale-105 opacity-90 shadow-[0_25px_70px_rgba(0,0,0,0.15)] duration-75' : 'duration-300'}
        ${activeTool === 'move' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}
      `}
      style={{
        width: gridSize - 4,
        height: gridSize - 4,
        left: visualPos.x,
        top: visualPos.y,
        // If selected, show a border. If highlighted edges exist, we draw them separately inside.
        border: isSelected ? '2px solid #007AFF' : '1px solid #e5e5e7',
        borderRadius: '12px'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOut={stopDrawing}
      onPointerEnter={() => onHover(data.id)}
      onPointerLeave={() => onHover(null)}
    >
      <canvas ref={canvasRef} className="w-full h-full block pointer-events-none rounded-lg" />

      {/* Clear Number ID - Centered overlay */}
      {showFaceIds && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
            <span className={`font-bold text-black select-none ${gridSize < 50 ? 'text-2xl' : 'text-6xl'}`}>{data.id + 1}</span>
        </div>
      )}

      {/* Vertex Labels (0:TL, 1:TR, 2:BR, 3:BL) - Positioned INSIDE */}
      {showSharedEdges && renderVertexLabel(0, "top-1 left-1")}
      {showSharedEdges && renderVertexLabel(1, "top-1 right-1")}
      {showSharedEdges && renderVertexLabel(2, "bottom-1 right-1")}
      {showSharedEdges && renderVertexLabel(3, "bottom-1 left-1")}

      {/* Edge Highlights */}
      {showSharedEdges && highlightEdges && (
        <>
            {highlightEdges.top && (
                <>
                <div className="absolute top-0 left-0 right-0 h-2 z-40" style={{ backgroundColor: highlightEdges.top.color }} />
                </>
            )}
            {highlightEdges.bottom && (
                <>
                <div className="absolute bottom-0 left-0 right-0 h-2 z-40" style={{ backgroundColor: highlightEdges.bottom.color }} />
                </>
            )}
            {highlightEdges.left && (
                <>
                <div className="absolute top-0 bottom-0 left-0 w-2 z-40" style={{ backgroundColor: highlightEdges.left.color }} />
                </>
            )}
            {highlightEdges.right && (
                <>
                <div className="absolute top-0 bottom-0 right-0 w-2 z-40" style={{ backgroundColor: highlightEdges.right.color }} />
                </>
            )}
        </>
      )}
    </div>
  );
});

DraggableFace.displayName = 'DraggableFace';
