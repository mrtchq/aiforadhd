import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface Particle {
  id: number;
  x: number; // percentage
  y: number; // percentage
  size: number; // pixels
  color: string;
  delay: number; // seconds
  duration: number; // seconds
  angle: number; // degrees
  drift: number; // pixels
}

export default function Celebration({ isVisible, onComplete }: { isVisible: boolean; onComplete: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (isVisible) {
      // Generate premium gold and rainbow metallic particles inspired by the brand
      const colors = [
        '#d8ad30', // Metallic Gold
        '#f59e0b', // Amber Gold
        '#fbbf24', // Yellow Gold
        '#a855f7', // Purple
        '#3b82f6', // Blue
        '#ec4899', // Pink
        '#ffffff', // Sparkle White
      ];

      const newParticles = Array.from({ length: 60 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100, // random horizontal start (0% to 100%)
        y: Math.random() * -20 - 10, // start above screen (-30% to -10%)
        size: Math.random() * 6 + 4, // 4px to 10px
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 1.5,
        duration: Math.random() * 2.5 + 2, // 2s to 4.5s
        angle: Math.random() * 360,
        drift: (Math.random() - 0.5) * 120, // drift left/right -60px to 60px
      }));

      setParticles(newParticles);

      // Automatically complete after 5 seconds
      const timer = setTimeout(() => {
        onComplete();
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          {/* 1. Golden Radiant Central Halo Aura */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.45, 0.45, 0], scale: [0.8, 1.2, 1.3, 1.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 4, times: [0, 0.2, 0.8, 1], ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div 
              className="w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full blur-[100px]" 
              style={{
                background: 'radial-gradient(circle, rgba(216, 173, 48, 0.15) 0%, rgba(141, 0, 202, 0.05) 40%, transparent 75%)'
              }}
            />
          </motion.div>

          {/* 2. Soft Gold Full-Screen Flash/Fade-In */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-b from-[#d8ad30]/10 to-transparent pointer-events-none"
          />

          {/* 3. Falling Confetti Particles */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ 
                x: `${p.x}vw`, 
                y: `${p.y}vh`, 
                rotation: p.angle, 
                opacity: 0,
                scale: 0.5
              }}
              animate={{ 
                y: '105vh', 
                x: `calc(${p.x}vw + ${p.drift}px)`,
                rotation: p.angle + 720,
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1, 1, 0.3]
              }}
              transition={{ 
                duration: p.duration, 
                delay: p.delay, 
                ease: [0.25, 0.1, 0.25, 1],
                times: [0, 0.15, 0.85, 1]
              }}
              className="absolute pointer-events-none rounded-full"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                boxShadow: p.color === '#d8ad30' || p.color === '#f59e0b' 
                  ? '0 0 8px rgba(216, 173, 48, 0.6)' 
                  : '0 0 6px rgba(255, 255, 255, 0.3)',
              }}
            />
          ))}

          {/* 4. Elegant Success Card / Badge */}
          <div className="absolute inset-x-0 top-1/4 flex justify-center items-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ 
                opacity: [0, 1, 1, 0], 
                scale: [0.85, 1, 1, 0.9],
                y: [20, 0, 0, -15] 
              }}
              transition={{ 
                duration: 3.5, 
                times: [0, 0.15, 0.85, 1],
                ease: "easeOut" 
              }}
              className="bg-neutral-950/90 border border-[#d8ad30]/40 px-6 py-4 rounded-2xl flex flex-col items-center gap-2.5 backdrop-blur-md shadow-[0_12px_40px_rgba(216,173,48,0.25)] text-center max-w-sm mx-4"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-[#d8ad30]/35 flex items-center justify-center text-[#d8ad30] shadow-[0_0_15px_rgba(216,173,48,0.2)]">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-white text-base tracking-tight uppercase">
                  Workspace <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200">Unlocked</span>
                </h3>
                <p className="text-neutral-400 text-xs font-light mt-1">
                  Welcome to the premium ADHD executive capsule.
                </p>
              </div>
              <div className="w-16 h-[1.5px] bg-gradient-to-r from-transparent via-[#d8ad30]/60 to-transparent" />
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
