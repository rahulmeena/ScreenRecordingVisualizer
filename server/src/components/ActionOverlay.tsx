'use client';

import { useEffect, useRef, useState } from 'react';

interface ActionOverlayProps {
  events: any[];
  containerRef: React.RefObject<HTMLDivElement>;
  currentTime: number;
  sourceResolution?: [number, number];
  debugMode?: boolean;
}

export default function ActionOverlay({ 
  events, 
  containerRef, 
  currentTime, 
  sourceResolution = [2560, 1440],
  debugMode = false 
}: ActionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showLegend, setShowLegend] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // Set up resize observer to update canvas size when container changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateCanvasSize = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      setCanvasSize({
        width: containerRect.width,
        height: containerRect.height
      });
    };
    
    // Initial size update
    updateCanvasSize();
    
    // Set up resize observer
    observerRef.current = new ResizeObserver(updateCanvasSize);
    observerRef.current.observe(containerRef.current);
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [containerRef]);
  
  // Draw events on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    
    // Get actual video element dimensions and position
    const videoElement = containerRef.current.querySelector('video');
    if (!videoElement) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Resize canvas to match container dimensions exactly
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    
    // Make sure canvas style dimensions match as well
    canvas.style.width = `${containerRect.width}px`;
    canvas.style.height = `${containerRect.height}px`;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const videoRect = videoElement.getBoundingClientRect();
    
    // Get the actual video display dimensions and position within the container
    const videoX = videoRect.left - containerRect.left;
    const videoY = videoRect.top - containerRect.top;
    const videoDisplayWidth = videoRect.width;
    const videoDisplayHeight = videoRect.height;
    
    // Get the actual content dimensions from the source resolution
    const [origWidth, origHeight] = sourceResolution;
    
    // Directly calculate the scale factor and content position
    const scaleFactorX = videoDisplayWidth / origWidth;
    const scaleFactorY = videoDisplayHeight / origHeight;
    
    // Function to map original coordinates to the displayed video
    const mapX = (x: number) => videoX + (x * scaleFactorX);
    const mapY = (y: number) => videoY + (y * scaleFactorY);
    
    // Debug visualization
    if (debugMode) {
      // Draw video element outline
      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 2;
      ctx.strokeRect(videoX, videoY, videoDisplayWidth, videoDisplayHeight);
      
      // Draw container outline
      ctx.strokeStyle = 'green';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, containerRect.width, containerRect.height);
      
      // Draw corner points
      ctx.fillStyle = 'yellow';
      // Top-left
      ctx.beginPath();
      ctx.arc(mapX(0), mapY(0), 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Top-right
      ctx.beginPath();
      ctx.arc(mapX(origWidth), mapY(0), 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Bottom-left
      ctx.beginPath();
      ctx.arc(mapX(0), mapY(origHeight), 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Bottom-right
      ctx.beginPath();
      ctx.arc(mapX(origWidth), mapY(origHeight), 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Center
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(mapX(origWidth/2), mapY(origHeight/2), 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Display actual scaling information - with background
      const debugBoxHeight = events.length > 0 ? 140 : 100;
      const debugBoxWidth = 400;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, debugBoxWidth, debugBoxHeight);
      
      ctx.fillStyle = 'white';
      ctx.font = '14px monospace';
      ctx.fillText(`Source: ${origWidth}x${origHeight}`, 20, 30);
      ctx.fillText(`Display: ${Math.round(videoDisplayWidth)}x${Math.round(videoDisplayHeight)}`, 20, 50);
      ctx.fillText(`Scale: ${scaleFactorX.toFixed(3)}x, ${scaleFactorY.toFixed(3)}y`, 20, 70);
      ctx.fillText(`Video Position: ${Math.round(videoX)},${Math.round(videoY)}`, 20, 90);
      
      // Show an example coordinate mapping
      if (events.length > 0) {
        const event = events[0];
        if (event.kind === 'mouse_down' || event.kind === 'scroll') {
          const mappedX = mapX(event.x);
          const mappedY = mapY(event.y);
          ctx.fillText(`Example event: (${event.x},${event.y}) -> (${Math.round(mappedX)},${Math.round(mappedY)})`, 20, 110);
        } else if (event.kind === 'drag_end') {
          const mappedStartX = mapX(event.start_x);
          const mappedStartY = mapY(event.start_y);
          const mappedEndX = mapX(event.end_x);
          const mappedEndY = mapY(event.end_y);
          ctx.fillText(`Example drag: (${event.start_x},${event.start_y}) -> (${Math.round(mappedStartX)},${Math.round(mappedStartY)})`, 20, 110);
          ctx.fillText(`             (${event.end_x},${event.end_y}) -> (${Math.round(mappedEndX)},${Math.round(mappedEndY)})`, 20, 130);
        }
      }
    }
    
    // Use the smaller scale factor for drawing elements (to maintain proportions)
    const uniformScale = Math.min(scaleFactorX, scaleFactorY);
    
    // Apply a size multiplier to make overlays larger
    const overlayScaleFactor = uniformScale * 2.0; // Increased from 1.5 to 2.0 (100% larger)
    
    // Draw legend if enabled
    if (showLegend) {
      drawLegend(ctx, canvas.width, overlayScaleFactor);
    }
    
    // Draw events
    events.forEach(event => {
      // Calculate animation progress (0 to 1) - events are visible for 1 second
      const eventTimeSeconds = event.t / 1000;
      const timeSinceEvent = currentTime - eventTimeSeconds;
      const animationProgress = 1 - timeSinceEvent; // 0 to 1, where 1 is just happened
      
      // Skip events that are outside the visible time window
      if (animationProgress <= 0) return;
      
      // Handle different event types
      switch (event.kind) {
        case 'mouse_down':
          // Ensure coordinates are within bounds
          if (event.x >= 0 && event.x <= origWidth && event.y >= 0 && event.y <= origHeight) {
            drawClick(ctx, mapX(event.x), mapY(event.y), event.button, animationProgress, overlayScaleFactor);
          }
          break;
        
        case 'key_down':
          drawKeyPress(ctx, event.key, animationProgress, overlayScaleFactor);
          break;
        
        case 'drag_end':
          // Ensure coordinates are within bounds
          if (
            event.start_x >= 0 && event.start_x <= origWidth && 
            event.start_y >= 0 && event.start_y <= origHeight &&
            event.end_x >= 0 && event.end_x <= origWidth && 
            event.end_y >= 0 && event.end_y <= origHeight
          ) {
            drawDrag(
              ctx, 
              mapX(event.start_x),
              mapY(event.start_y),
              mapX(event.end_x),
              mapY(event.end_y),
              animationProgress,
              overlayScaleFactor
            );
          }
          break;
        
        case 'scroll':
          // Ensure coordinates are within bounds
          if (event.x >= 0 && event.x <= origWidth && event.y >= 0 && event.y <= origHeight) {
            drawScroll(ctx, mapX(event.x), mapY(event.y), event.dy, animationProgress, overlayScaleFactor);
          }
          break;
      }
    });
  }, [events, containerRef, currentTime, showLegend, sourceResolution, debugMode, canvasSize]);
  
  // Draw a mouse click with animation
  function drawClick(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    button: string, 
    progress: number,
    scale: number
  ) {
    if (progress <= 0) return;
    
    const baseRadius = (button === 'right' ? 18 : 25) * scale; // Increased base size
    // Scale for animation - starts larger and shrinks
    const animatedRadius = baseRadius * (1 + (1 - progress) * 0.5);
    const opacity = Math.max(0.1, progress);
    
    const color = button === 'right' 
      ? `rgba(255, 160, 0, ${opacity * 0.7})` // Increased opacity
      : `rgba(255, 0, 0, ${opacity * 0.7})`; // Increased opacity
    
    // Draw outer circle
    ctx.beginPath();
    ctx.arc(x, y, animatedRadius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw inner circle
    ctx.beginPath();
    ctx.arc(x, y, animatedRadius - 6 * scale, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.9})`; // Increased opacity
    ctx.lineWidth = 3 * scale; // Increased line width
    ctx.stroke();
    
    // Add label
    const label = button === 'right' ? 'Right Click' : 'Left Click';
    drawLabel(ctx, x, y + animatedRadius + 20 * scale, label, color, scale);
  }
  
  // Draw a key press with animation
  function drawKeyPress(ctx: CanvasRenderingContext2D, key: string, progress: number, scale: number) {
    if (progress <= 0) return;
    
    const opacity = Math.max(0.2, progress);
    const text = key.length === 1 ? key.toUpperCase() : key;
    const fontSize = (20 + (1 - progress) * 4) * scale; // Increased from 16 to 20
    
    // Position at bottom center instead of top center
    const x = ctx.canvas.width / 2;
    const y = ctx.canvas.height - 80 * scale; // Positioned near bottom
    
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(text).width;
    
    // Background with rounded corners
    const bgWidth = textWidth + 40 * scale; // Increased padding
    const bgHeight = fontSize + 20 * scale; // Increased height
    const radius = 10 * scale; // Increased border radius
    
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.9})`; // Increased opacity
    ctx.beginPath();
    ctx.moveTo(x - bgWidth/2 + radius, y - bgHeight/2);
    ctx.lineTo(x + bgWidth/2 - radius, y - bgHeight/2);
    ctx.quadraticCurveTo(x + bgWidth/2, y - bgHeight/2, x + bgWidth/2, y - bgHeight/2 + radius);
    ctx.lineTo(x + bgWidth/2, y + bgHeight/2 - radius);
    ctx.quadraticCurveTo(x + bgWidth/2, y + bgHeight/2, x + bgWidth/2 - radius, y + bgHeight/2);
    ctx.lineTo(x - bgWidth/2 + radius, y + bgHeight/2);
    ctx.quadraticCurveTo(x - bgWidth/2, y + bgHeight/2, x - bgWidth/2, y + bgHeight/2 - radius);
    ctx.lineTo(x - bgWidth/2, y - bgHeight/2 + radius);
    ctx.quadraticCurveTo(x - bgWidth/2, y - bgHeight/2, x - bgWidth/2 + radius, y - bgHeight/2);
    ctx.closePath();
    ctx.fill();
    
    // Key text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.fillText(text, x, y);
  }
  
  // Draw a drag operation with animation
  function drawDrag(
    ctx: CanvasRenderingContext2D, 
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number,
    progress: number,
    scale: number
  ) {
    if (progress <= 0) return;
    
    const opacity = Math.max(0.2, progress);
    const color = `rgba(0, 200, 0, ${opacity * 0.8})`;
    
    // Calculate the animated end point
    const animatedEndX = startX + (endX - startX) * progress;
    const animatedEndY = startY + (endY - startY) * progress;
    
    // Draw start point
    ctx.beginPath();
    ctx.arc(startX, startY, 10 * scale, 0, 2 * Math.PI); // Increased from 8
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw path line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(animatedEndX, animatedEndY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5 * scale; // Increased from 4
    ctx.stroke();
    
    // Draw end point
    ctx.beginPath();
    ctx.arc(animatedEndX, animatedEndY, 15 * scale, 0, 2 * Math.PI); // Increased from 12
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw arrow head if we're at least 50% through the drag
    if (progress >= 0.5) {
      const angle = Math.atan2(endY - startY, endX - startX);
      const length = 18 * scale; // Increased from 15
      
      ctx.beginPath();
      ctx.moveTo(animatedEndX, animatedEndY);
      ctx.lineTo(
        animatedEndX - length * Math.cos(angle - Math.PI / 6),
        animatedEndY - length * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        animatedEndX - length * Math.cos(angle + Math.PI / 6),
        animatedEndY - length * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      
      // Add "Drag" label near the end point
      drawLabel(ctx, animatedEndX, animatedEndY + 35 * scale, "Drag", color, scale); // Increased offset
    }
  }
  
  // Draw scroll action with animation
  function drawScroll(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    direction: number,
    progress: number,
    scale: number
  ) {
    if (progress <= 0) return;
    
    const opacity = Math.max(0.2, progress);
    const color = `rgba(0, 100, 255, ${opacity * 0.8})`;
    
    // Draw scroll indicator
    const baseSize = 50 * scale; // Increased from 40
    const size = baseSize * (1 + (1 - progress) * 0.5); // Animation effect - grows slightly
    
    // Draw background circle
    ctx.beginPath();
    ctx.arc(x, y, size/2, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(0, 100, 255, ${opacity * 0.5})`; // Increased opacity
    ctx.fill();
    
    // Draw scroll direction arrow
    const arrowHeight = size * 0.65; // Increased from 0.6
    const arrowWidth = arrowHeight * 0.75;
    
    ctx.beginPath();
    if (direction > 0) {
      // Scroll down
      ctx.moveTo(x, y + arrowHeight / 2);
      ctx.lineTo(x - arrowWidth / 2, y - arrowHeight / 2);
      ctx.lineTo(x + arrowWidth / 2, y - arrowHeight / 2);
    } else {
      // Scroll up
      ctx.moveTo(x, y - arrowHeight / 2);
      ctx.lineTo(x - arrowWidth / 2, y + arrowHeight / 2);
      ctx.lineTo(x + arrowWidth / 2, y + arrowHeight / 2);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    
    // Add "Scroll" label
    const scrollLabel = direction > 0 ? "Scroll Down" : "Scroll Up";
    drawLabel(ctx, x, y + size/2 + 25 * scale, scrollLabel, color, scale); // Increased offset
  }
  
  // Helper to draw labels with background
  function drawLabel(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    text: string, 
    color: string,
    scale: number
  ) {
    const fontSize = 14 * scale; // Increased from 12
    ctx.font = `${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(text).width;
    
    // Background for label
    const pad = 6 * scale; // Increased padding
    const boxHeight = 24 * scale; // Increased height
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Increased opacity
    
    // Rounded rectangle for background
    const radius = 4 * scale;
    const rectX = x - textWidth/2 - pad;
    const rectY = y - boxHeight/2;
    const rectWidth = textWidth + pad * 2;
    const rectHeight = boxHeight;
    
    ctx.beginPath();
    ctx.moveTo(rectX + radius, rectY);
    ctx.lineTo(rectX + rectWidth - radius, rectY);
    ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
    ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
    ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
    ctx.lineTo(rectX + radius, rectY + rectHeight);
    ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
    ctx.lineTo(rectX, rectY + radius);
    ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
    ctx.closePath();
    ctx.fill();
    
    // Label text
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }
  
  // Draw legend in corner
  function drawLegend(ctx: CanvasRenderingContext2D, canvasWidth: number, scale: number) {
    const padding = 10 * scale;
    const itemHeight = 25 * scale;
    const legendWidth = 130 * scale;
    const x = canvasWidth - legendWidth - padding;
    let y = padding;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - padding, y - padding, legendWidth + padding*2, itemHeight*4 + padding*2);
    
    // Legend items
    drawLegendItem(ctx, x, y, 'rgba(255, 0, 0, 0.6)', 'Left Click', scale);
    y += itemHeight;
    
    drawLegendItem(ctx, x, y, 'rgba(0, 200, 0, 0.6)', 'Drag', scale, false);
    y += itemHeight;
    
    drawLegendItem(ctx, x, y, 'rgba(0, 100, 255, 0.6)', 'Scroll', scale, false);
    y += itemHeight;
    
    drawLegendItem(ctx, x, y, 'rgba(0, 0, 0, 0.85)', 'Key Press', scale, true);
  }
  
  // Draw a legend item
  function drawLegendItem(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    color: string, 
    text: string,
    scale: number,
    isKeyboard: boolean = false
  ) {
    // Draw color indicator
    if (isKeyboard) {
      // For keyboard, draw a key shape
      const keySize = 16 * scale;
      ctx.fillStyle = 'white';
      ctx.fillRect(x, y + 4 * scale, keySize, keySize);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(x, y + 4 * scale, keySize, keySize);
    } else {
      // For mouse events, draw a circle
      ctx.beginPath();
      ctx.arc(x + 8 * scale, y + 12 * scale, 8 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
    
    // Draw text
    ctx.font = `${14 * scale}px sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 25 * scale, y + 12 * scale);
  }
  
  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
    </>
  );
} 