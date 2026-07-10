import React from 'react';
import { motion } from 'motion/react';
import { Heart, Sparkles } from 'lucide-react';

export default function BelongSection() {
  const bullets = [
    "You’ve tried countless physical journals & planners, only to abandon them within a week.",
    "Your brain constantly feels like it has 47 tabs open, with music playing in the background.",
    "You freeze in place (task paralysis) when tasks feel too big, vague, or boring.",
    "You want to harness the power of AI, but complex setups and tech-jargon feel intimidating.",
    "You need ultra-practical, simple support systems, not another lecture on productivity guilt.",
    "You’re completely tired of starting over alone in silence, thinking it's a personal flaw."
  ];

  return (
    <section id="belong-section" className="py-24 px-6 relative overflow-hidden bg-black">
      {/* Soft warm gold background aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-neutral-900 to-transparent" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="bg-gradient-to-b from-neutral-950 to-neutral-950/40 border border-neutral-900 rounded-3xl p-8 sm:p-12 md:p-16 gold-glow relative overflow-hidden">
          {/* Subtle rainbow accent glow bar on left */}
          <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-blue-500 via-purple-500 to-amber-500" />
          
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">
              Shame-Free Environment
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-extrabold text-white tracking-tight mb-8">
            You <span className="text-gold-gradient font-black gold-glow-text">Belong Here</span> If...
          </h2>

          {/* Grid of Bullets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 select-none">
            {bullets.map((bullet, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="flex items-start gap-3.5 group p-2 rounded-xl hover:bg-neutral-900/40 transition-colors"
              >
                {/* Glowing Gold Check circle */}
                <div className="mt-1 flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 group-hover:border-amber-500 group-hover:bg-amber-500 group-hover:text-black shrink-0 transition-all duration-300">
                  <span className="text-[10px] font-bold text-amber-300 group-hover:text-neutral-950">✓</span>
                </div>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed font-sans font-light">
                  {bullet}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Compassionate Reassurance Anchor Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative p-6 sm:p-8 rounded-2xl bg-neutral-950 border border-amber-500/25 gold-glow-intense text-center overflow-hidden"
          >
            {/* Soft gold sparkles */}
            <div className="absolute top-2 left-2 text-amber-500/15">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="absolute bottom-2 right-2 text-amber-500/15">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>

            <p className="font-display text-lg sm:text-xl md:text-2xl font-semibold text-white leading-relaxed mb-2">
              “Your brain is not broken. <br className="sm:hidden" /> The system just needs to be built differently.”
            </p>
            <p className="text-xs font-mono text-amber-400 uppercase tracking-widest mt-3">
              No judgment. No perfect routines. Just systems that bend to fit you.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
