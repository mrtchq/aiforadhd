import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
const logoImg = "https://subpagebucket.s3.eu-north-1.amazonaws.com/library/934/3dbb9e7c-a5a5-480a-a2e4-e42a2c92e4b0.png";

interface BrainNode {
  id: number;
  cx: number;
  cy: number;
  color: string;
  size: number;
  side: 'left' | 'right';
  label?: string;
}

export default function InteractiveBrainLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Core synapses of an ADHD brain: colorful, interconnected, sparkling
  const nodes: BrainNode[] = [
    // Left hemisphere - Logic & Structure (Blue/Cyan/Purple)
    { id: 1, cx: 160, cy: 110, color: '#3b82f6', size: 5, side: 'left' },
    { id: 2, cx: 130, cy: 140, color: '#06b6d4', size: 6, side: 'left' },
    { id: 3, cx: 110, cy: 180, color: '#8b5cf6', size: 5, side: 'left' },
    { id: 4, cx: 130, cy: 230, color: '#3b82f6', size: 7, side: 'left' },
    { id: 5, cx: 160, cy: 270, color: '#06b6d4', size: 5, side: 'left' },
    { id: 6, cx: 180, cy: 200, color: '#8b5cf6', size: 6, side: 'left' },
    { id: 7, cx: 150, cy: 170, color: '#3b82f6', size: 4, side: 'left' },
    { id: 8, cx: 190, cy: 140, color: '#06b6d4', size: 5, side: 'left' },
    
    // Right hemisphere - Creativity, Hyperfocus & Ideas (Pink/Orange/Yellow/Green)
    { id: 9, cx: 240, cy: 110, color: '#ec4899', size: 5, side: 'right' },
    { id: 10, cx: 270, cy: 140, color: '#f97316', size: 7, side: 'right' },
    { id: 11, cx: 290, cy: 180, color: '#eab308', size: 5, side: 'right' },
    { id: 12, cx: 270, cy: 230, color: '#22c55e', size: 6, side: 'right' },
    { id: 13, cx: 240, cy: 270, color: '#ec4899', size: 5, side: 'right' },
    { id: 14, cx: 220, cy: 200, color: '#f97316', size: 8, side: 'right' },
    { id: 15, cx: 250, cy: 170, color: '#eab308', size: 4, side: 'right' },
    { id: 16, cx: 210, cy: 140, color: '#22c55e', size: 5, side: 'right' },
  ];

  // Map of connection indices to form a beautiful neural mesh
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 7], [7, 1], [5, 6], [7, 0],
    [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 8], [14, 15], [15, 9], [13, 14], [15, 8],
    [6, 14], [0, 8], [4, 12] // Bridges connecting both hemispheres
  ];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    });
  };

  const resetMouse = () => {
    setMousePos({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <div 
      id="brand-logo-container"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={resetMouse}
      className="relative w-80 h-[28rem] mx-auto flex flex-col items-center justify-start select-none cursor-pointer group"
    >
      {/* 1. Ambient Background Rainbow Aura (gentle movement behind the logo) */}
      <div className="absolute inset-x-0 top-0 h-80 rounded-full bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-amber-500/10 blur-3xl opacity-60 group-hover:opacity-90 transition-opacity duration-700 animate-pulse pointer-events-none" />
      
      {/* 2. Soft Gold Glow Backlight */}
      <div className="absolute w-56 h-56 top-12 rounded-full bg-amber-500/5 blur-2xl group-hover:bg-amber-500/10 transition-all duration-700 pointer-events-none" />

      {/* 3. Spinning Outer Gold Orbit ring with ticks (Centered precisely around the brain part) */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute w-72 h-72 rounded-full border border-dashed border-amber-500/25 flex items-center justify-center top-6 pointer-events-none"
      >
        <div className="absolute -top-1 w-2 h-2 rounded-full bg-amber-500/80 shadow-[0_0_8px_#D4AF37]" />
        <div className="absolute -bottom-1 w-2 h-2 rounded-full bg-amber-500/80 shadow-[0_0_8px_#D4AF37]" />
      </motion.div>

      {/* 4. Second Faster Golden Circuit Ring (Centered precisely around the brain part) */}
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute w-[16.5rem] h-[16.5rem] rounded-full border border-amber-500/10 flex items-center justify-center top-[3.75rem] pointer-events-none"
      >
        <div className="absolute -left-0.5 w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
        <div className="absolute -right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
      </motion.div>

      {/* 5. Combined Motion Wrapper for Spring Parallax of both Logo and Interactive synapses */}
      <motion.div
        className="relative w-80 h-[26rem] flex flex-col items-center justify-start pt-6 z-10 pointer-events-none"
        animate={{
          x: isHovered ? mousePos.x * 0.12 : 0,
          y: isHovered ? mousePos.y * 0.12 : 0,
          scale: isHovered ? 1.03 : 1,
        }}
        transition={{ type: "spring", stiffness: 150, damping: 20 }}
      >
        {/* The beautiful centered brand logo image */}
        <img
          src={logoImg}
          alt="AI for ADHD Logo"
          referrerPolicy="no-referrer"
          className="w-56 h-auto z-10 select-none drop-shadow-[0_0_20px_rgba(212,175,55,0.3)] group-hover:drop-shadow-[0_0_35px_rgba(212,175,55,0.55)] transition-all duration-500"
        />

        {/* Dynamic, interactive neural connection overlay - maps on top of the logo brain */}
        <svg
          viewBox="0 0 400 400"
          className="absolute w-72 h-72 top-4 z-20 pointer-events-none opacity-25 group-hover:opacity-60 transition-opacity duration-500"
        >
          {/* Glow Filters */}
          <defs>
            <filter id="gold-neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="neon-synapse-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="20%" stopColor="#06b6d4" />
              <stop offset="40%" stopColor="#8b5cf6" />
              <stop offset="60%" stopColor="#ec4899" />
              <stop offset="80%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>

          {/* Central glowing golden crest/shield outline backing the brain */}
          <path
            d="M 200 65 C 240 65, 305 105, 305 200 C 305 295, 200 335, 200 335 C 200 335, 95 295, 95 200 C 95 105, 160 65, 200 65 Z"
            fill="none"
            stroke="url(#rainbowGrad)"
            strokeWidth="1.5"
            strokeOpacity="0.12"
          />
          
          {/* Central Gold Spine Axis (The Stabilizing AI architecture) */}
          <line
            x1="200"
            y1="90"
            x2="200"
            y2="310"
            stroke="#D4AF37"
            strokeWidth="2.5"
            strokeOpacity="0.4"
            strokeDasharray="6,4"
          />

          {/* Synapse Connections / Laser paths */}
          <g id="synapse-connections">
            {connections.map(([fromIdx, toIdx], index) => {
              const fromNode = nodes[fromIdx];
              const toNode = nodes[toIdx];
              // Determine line gradient color representation based on brain side
              const isLeft = fromNode.side === 'left' && toNode.side === 'left';
              const isRight = fromNode.side === 'right' && toNode.side === 'right';
              const strokeColor = isLeft ? '#06b6d4' : isRight ? '#ec4899' : '#8b5cf6';

              return (
                <motion.line
                  key={`connection-${index}`}
                  x1={fromNode.cx}
                  y1={fromNode.cy}
                  x2={toNode.cx}
                  y2={toNode.cy}
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  initial={{ opacity: 0.2 }}
                  animate={{
                    opacity: isHovered ? [0.3, 0.8, 0.3] : [0.15, 0.45, 0.15],
                    strokeWidth: isHovered ? 2 : 1.2
                  }}
                  transition={{
                    duration: 3 + (index % 3),
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              );
            })}
          </g>

          {/* Neural Synapse Nodes */}
          <g id="neural-nodes">
            {nodes.map((node) => {
              // Mouse proximity offset on individual nodes for neat cybernetic interaction
              const dx = isHovered ? mousePos.x * 0.05 : 0;
              const dy = isHovered ? mousePos.y * 0.05 : 0;

              return (
                <g key={`node-${node.id}`}>
                  {/* Node Outer Pulsing Aura */}
                  <motion.circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.size * 2.2}
                    fill={node.color}
                    initial={{ opacity: 0.1 }}
                    animate={{
                      opacity: isHovered ? [0.15, 0.45, 0.15] : [0.05, 0.2, 0.05],
                      scale: [1, 1.25, 1],
                    }}
                    transition={{
                      duration: 2 + (node.id % 4),
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    style={{
                      transformOrigin: `${node.cx}px ${node.cy}px`
                    }}
                  />

                  {/* Main Node */}
                  <motion.circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.size}
                    fill={node.color}
                    stroke="#ffffff"
                    strokeWidth="1"
                    strokeOpacity="0.6"
                    animate={{
                      cx: node.cx + dx,
                      cy: node.cy + dy,
                    }}
                    transition={{ type: "spring", stiffness: 120, damping: 15 }}
                  />

                  {/* Outer metallic accent core on specific brain stem points */}
                  {(node.id === 4 || node.id === 10 || node.id === 14) && (
                    <motion.circle
                      cx={node.cx}
                      cy={node.cy}
                      r={node.size + 4}
                      fill="none"
                      stroke="#D4AF37"
                      strokeWidth="1"
                      animate={{
                        cx: node.cx + dx,
                        cy: node.cy + dy,
                        scale: [1, 1.4, 1]
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                      style={{
                        transformOrigin: `${node.cx}px ${node.cy}px`
                      }}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Central Glowing Cybernetic Cortex (pulsing gold ring) */}
          <motion.circle
            cx="200"
            cy="190"
            r="16"
            fill="none"
            stroke="#D4AF37"
            strokeWidth="1.5"
            filter="url(#gold-neon-glow)"
            animate={{
              scale: isHovered ? [1, 1.15, 1] : [0.95, 1.05, 0.95],
              opacity: [0.3, 0.7, 0.3]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "200px 190px" }}
          />
          <circle cx="200" cy="190" r="4" fill="#D4AF37" />
        </svg>
      </motion.div>

      {/* Floating Stardust particle items (Beginner-friendly supportive visuals) */}
      <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
        <div className="absolute w-1 h-1 bg-yellow-400 rounded-full top-1/4 left-1/4 animate-ping opacity-30" style={{ animationDuration: '4s' }} />
        <div className="absolute w-1.5 h-1.5 bg-cyan-400 rounded-full top-2/3 left-1/3 animate-ping opacity-45" style={{ animationDuration: '6s' }} />
        <div className="absolute w-1 h-1 bg-pink-400 rounded-full top-1/3 right-1/4 animate-ping opacity-40" style={{ animationDuration: '5s' }} />
        <div className="absolute w-1.5 h-1.5 bg-yellow-200 rounded-full bottom-1/4 right-1/3 animate-ping opacity-30" style={{ animationDuration: '7s' }} />
      </div>
    </div>
  );
}
