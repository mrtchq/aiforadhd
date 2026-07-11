import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpPoint } from '../types';
import { Sparkles, HelpCircle, X, ChevronRight } from 'lucide-react';

export default function CardGrid() {
  const [activeHackId, setActiveHackId] = useState<string | null>(null);

  const helpPoints: HelpPoint[] = [
    {
      id: 'task-paralysis',
      title: 'Task Paralysis',
      emoji: '🌀',
      color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400',
      description: 'When you freeze because starting a simple task feels like climbing Mount Everest.',
      tip: 'Ask Gemini: "I have task paralysis about X. Give me only the first 3-minute physical step to start. Do not explain or write a list. Just the very first tiny action."'
    },
    {
      id: 'brain-dumps',
      title: 'Brain Dumps',
      emoji: '📝',
      color: 'from-cyan-500/20 to-teal-500/20 border-cyan-500/30 text-cyan-400',
      description: 'When your brain is overflowing with a chaotic storm of ideas, tasks, worries, and half-baked plans.',
      tip: 'Dictate a messy 1-minute voice memo of your chaotic mind, then tell AI: "Clean this mess up, categorize it, and draft them as clean Todoist tasks."'
    },
    {
      id: 'planning',
      title: 'Planning',
      emoji: '🗺️',
      color: 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30 text-purple-400',
      description: 'When looking at a blank page or rigid calendar makes you feel scattered or instantly bored.',
      tip: 'Let AI sequence your raw list dynamically: "Here is my list. Arrange these in order of cognitive effort so I can match them to my energy levels."'
    },
    {
      id: 'time-blindness',
      title: 'Time Blindness',
      emoji: '⏳',
      color: 'from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400',
      description: 'Losing track of where the last 3 hours went, or feeling like "now" and "not now" are the only time zones.',
      tip: 'Integrate Todoist with custom AI time buffers: Ask AI to add realistic "ADHD tax" buffer zones (like 20 mins) before and after all tasks.'
    },
    {
      id: 'email-chaos',
      title: 'Email Chaos',
      emoji: '✉️',
      color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-400',
      description: 'Staring at hundreds of unread emails and newsletters and feeling too guilty to open or archive them.',
      tip: 'Paste a long, daunting email into your AI assistant: "Give me a 2-bullet summary and draft a friendly, 1-sentence response I can copy/paste."'
    },
    {
      id: 'decision-fatigue',
      title: 'Decision Fatigue',
      emoji: '🤯',
      color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-400',
      description: 'Freezing over what to cook for dinner, what to wear, or which work email to tackle first.',
      tip: 'Give AI 3 options: "I am exhausted. Choose ONE of these for me to do based on low executive energy, and explain why in exactly 10 words."'
    },
    {
      id: 'routines',
      title: 'Routines',
      emoji: '🔄',
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
      description: 'Building a flawless 12-step morning routine on Monday, only to completely abandon it by Wednesday.',
      tip: 'Build modular, "Minimum Viable Routines". Ask AI: "Create a 2-step routine for mornings when I have absolutely zero executive function."'
    },
    {
      id: 'getting-unstuck',
      title: 'Getting Unstuck',
      emoji: '🚀',
      color: 'from-red-500/20 to-pink-500/20 border-red-500/30 text-rose-400',
      description: 'Trapped in an infinite social scroll-loop, feeling guilt, and unable to switch to a healthy activity.',
      tip: 'Ask your AI Agent (like Hermes) to act as a friendly body-double: "I am stuck on my phone. Talk to me like a supportive coach to stand up."'
    }
  ];

  return (
    <section id="helps-with-section" className="py-24 px-6 relative overflow-hidden bg-neutral-950/25">
      {/* Visual background lines and gold accents */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/10 to-transparent" />
      <div className="absolute -left-40 top-1/4 w-80 h-80 rounded-full bg-blue-500/5 blur-3xl" />
      <div className="absolute -right-40 bottom-1/4 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-extrabold tracking-tight text-white mb-4">
            A Mastermind Crafted for the <br className="hidden sm:inline" />
            <span className="text-gold-gradient font-black gold-glow-text">Curious, and the Non-Technical</span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-light">
            You don't need to be technical. You don't need to be confident. You just need to show up. We build simple AI structures to handle the parts of life that feel harder than they should.
          </p>
        </div>

        {/* The 8-Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {helpPoints.map((item) => (
            <motion.div
              key={item.id}
              onClick={() => setActiveHackId(activeHackId === item.id ? null : item.id)}
              whileHover={{ y: -6, scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`relative cursor-pointer select-none overflow-hidden rounded-2xl border p-6 bg-gradient-to-b ${item.color} transition-all duration-300 group ${
                activeHackId === item.id ? 'ring-2 ring-amber-500/50 shadow-[0_0_20px_rgba(212,175,55,0.15)]' : 'hover:border-amber-500/30'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                  {item.emoji}
                </span>
                
                {/* Visual action cue */}
                <div className="w-6 h-6 rounded-full bg-black/40 border border-neutral-800 flex items-center justify-center text-[10px] text-amber-400 group-hover:bg-amber-500 group-hover:text-black transition-all">
                  {activeHackId === item.id ? <X className="w-3 h-3" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </div>
              </div>

              {/* Card Title */}
              <h3 className="text-lg font-display font-bold text-white mb-2 tracking-tight flex items-center gap-1.5">
                {item.title}
              </h3>

              {/* Card Description */}
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-1 pr-2">
                {item.description}
              </p>

              {/* Action Prompt Tag */}
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-1 text-[11px] font-mono font-medium text-amber-400/80 uppercase tracking-wide">
                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>{activeHackId === item.id ? 'Hide Hack' : 'Show AI Hack'}</span>
              </div>

              {/* Revealable Actionable AI Hack Drawer */}
              <AnimatePresence>
                {activeHackId === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 bg-black/80 rounded-xl border border-amber-500/20 text-xs text-amber-200 leading-relaxed font-sans relative">
                      <div className="absolute top-1 right-2 text-[8px] font-mono text-neutral-500 uppercase">Interactive Prompt</div>
                      <p className="font-semibold text-white mb-1 flex items-center gap-1">
                        🚀 Try this:
                      </p>
                      <span className="italic">{item.tip}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
