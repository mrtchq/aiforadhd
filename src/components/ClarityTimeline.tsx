import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Compass, Layers, Zap, Info, ArrowUpRight } from 'lucide-react';
import { ClarityWeek } from '../types';

export default function ClarityTimeline() {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  const weeks: ClarityWeek[] = [
    {
      week: 1,
      title: 'Contain the Chaos',
      goal: 'Get open loops out of your head safely',
      description: 'Before configuring complex bots, we must stop the immediate mental leakage. We establish a painless capture system.',
      steps: [
        'Perform a guided AI Brain Dump to siphon lingering worries, chores, and projects.',
        'Configure your Todoist "Inbox" as the singular trusted bucket for all raw thoughts.',
        'Learn the 2-second shortcut to capture items hands-free from your phone or voice.'
      ]
    },
    {
      week: 2,
      title: 'Build the System',
      goal: 'Structure tasks without productivity guilt',
      description: 'Translate your raw brain dump into sorted, approachable micro-actions. No elaborate folders or over-categorized tags.',
      steps: [
        'Set up 3 modular Todoist folders: "Now", "Next", and "Sometime Later".',
        'Use custom Gemini Prompts to instantly chunk massive tasks into tiny 5-minute sub-steps.',
        'Establish a "Daily Reset" checklist to reset your screen and mind with zero shame.'
      ]
    },
    {
      week: 3,
      title: 'Refine and Repeat',
      goal: 'Review what worked, simplify what broke',
      description: 'Systems break when they are too heavy. In Step 3, we analyze friction points and let Hermes Agent handle routine upkeep.',
      steps: [
        'Analyze what broke during the week with a 5-minute shame-free diagnostic template.',
        'Connect Hermes Agent to automate routine cleanup and gentle follow-up reminders.',
        'Protect your momentum: simple maintenance workflows requiring under 10 minutes a week.'
      ]
    }
  ];

  return (
    <section id="clarity-timeline-section" className="py-24 px-6 relative overflow-hidden bg-neutral-950/40">
      {/* Dynamic background lighting */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-gradient-to-tr from-purple-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/5 to-transparent blur-3xl pointer-events-none" />
      
      {/* Grid separator lines */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-20">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-3 uppercase">
            <Calendar className="w-3.5 h-3.5" />
            Launch Roadmap
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-extrabold text-white tracking-tight">
            Starting July 13th: <br />
            <span className="text-gold-gradient font-black gold-glow-text">Three Weeks of C.L.A.R.I.T.Y.</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto mt-4 leading-relaxed">
            A simple, shame-free launch series designed to help you move from scattered thoughts to practical AI-supported systems.
          </p>
        </div>

        {/* Vertical Timeline Track */}
        <div className="relative border-l border-neutral-900 ml-4 sm:ml-32 space-y-16">
          {weeks.map((weekData, index) => {
            const isHovered = hoveredWeek === weekData.week;
            const borderColors = [
              'border-cyan-500/20 hover:border-cyan-500/40 shadow-cyan-950/20',
              'border-purple-500/20 hover:border-purple-500/40 shadow-purple-950/20',
              'border-amber-500/20 hover:border-amber-500/40 shadow-amber-950/20'
            ];
            
            const dotAuraColors = [
              'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-cyan-500/30',
              'bg-purple-500/20 border-purple-400 text-purple-400 shadow-purple-500/30',
              'bg-amber-500/20 border-amber-400 text-amber-400 shadow-amber-500/30'
            ];

            const energyLevels = [
              { label: 'Low Energy Load', desc: 'No complex tasks, mostly siphoning thoughts.', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
              { label: 'Moderate Focus', desc: 'Short 10-minute setup sessions.', style: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
              { label: 'Refine & Streamline', desc: 'Removing friction and simplifying.', style: 'bg-amber-500/10 text-amber-300 border-amber-500/20' }
            ];

            return (
              <motion.div
                key={weekData.week}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative pl-8 sm:pl-12 group"
                onMouseEnter={() => setHoveredWeek(weekData.week)}
                onMouseLeave={() => setHoveredWeek(null)}
              >
                {/* Timeline Node Point */}
                <div className={`absolute -left-[13px] top-1.5 w-6 h-6 rounded-full border-2 bg-black flex items-center justify-center transition-all duration-300 shadow-lg ${
                  isHovered ? dotAuraColors[index] + ' scale-110 shadow-[0_0_12px_currentColor]' : 'border-neutral-800 text-neutral-500'
                }`}>
                  <span className="text-[10px] font-mono font-bold">{weekData.week}</span>
                </div>

                {/* Left side Week Badge (visible only on md/lg screens) */}
                <div className="hidden sm:block absolute -left-32 top-1.5 text-right w-24">
                  <span className="text-2xl font-mono font-black text-neutral-800 group-hover:text-amber-500/35 transition-colors duration-300">
                    STEP {weekData.week}
                  </span>
                  <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                    Step {weekData.week}
                  </div>
                </div>

                {/* Main Content Card */}
                <div className={`bg-neutral-950/80 border ${borderColors[index]} rounded-2xl p-6 sm:p-8 transition-all duration-300 ${
                  isHovered ? 'shadow-2xl translate-x-1' : ''
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      {/* Mobile phase indicator */}
                      <span className="sm:hidden block text-xs font-mono font-bold text-amber-500 uppercase tracking-widest mb-1">
                        STEP {weekData.week}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                        {weekData.title}
                      </h3>
                      <p className="text-amber-500/80 font-mono text-xs mt-0.5">
                        Goal: {weekData.goal}
                      </p>
                    </div>

                    {/* ADHD-friendly energy budget tag */}
                    <div className="flex flex-col items-end">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border ${energyLevels[index].style}`}>
                        {energyLevels[index].label}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-6">
                    {weekData.description}
                  </p>

                  {/* Practical, shame-free steps */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-500 font-bold">
                      What we will do:
                    </h4>
                    <div className="space-y-2.5">
                      {weekData.steps.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-3 text-xs sm:text-sm text-gray-300">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-900 border border-neutral-800 text-amber-400 font-mono text-[10px] shrink-0 mt-0.5">
                            {sIdx + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shame-Free Guarantee footer in card */}
                  <div className="mt-6 pt-4 border-t border-neutral-900/50 flex items-center gap-2 text-[11px] font-sans text-neutral-500 italic">
                    <Info className="w-3.5 h-3.5 text-amber-500/40 shrink-0" />
                    <span>Started late? Slipped behind? Totally fine. Every guide remains permanently accessible.</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
