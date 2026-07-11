import React from 'react';
import { motion } from 'motion/react';
import { CheckSquare, Brain, Bot, Database, Sparkles, Cpu, ArrowRight, ArrowUpRight } from 'lucide-react';
import { StackComponent } from '../types';

export default function SystemStack() {
  const stackItems: StackComponent[] = [
    {
      title: 'Todoist',
      subtitle: 'Your External Brain',
      description: 'Capture tasks, reminders, ideas, and next actions in one trusted place instantly, before they slip away.',
      iconName: 'checkSquare',
      badge: 'Capture Layer',
      accentColor: 'border-rose-500/30 text-rose-400 bg-rose-500/5 glow-rose',
      websiteUrl: 'https://get.todoist.io/9394zgp0lnnd',
    },
    {
      title: 'AI Prompts',
      subtitle: 'Your Thinking Partner',
      description: 'Use custom, beginner-friendly AI templates to sort mental chaos, shrink daunting tasks, and clarify what to do next.',
      iconName: 'brain',
      badge: 'Processing Layer',
      accentColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5 glow-cyan',
    },
    {
      title: 'Hermes Agent',
      subtitle: 'Your Automation Assistant',
      description: 'Let your intelligent companion automate routine check-ins, maintain the lists, and support follow-through with zero pressure.',
      iconName: 'bot',
      badge: 'Automation Layer',
      accentColor: 'border-purple-500/30 text-purple-400 bg-purple-500/5 glow-purple',
      websiteUrl: 'https://hermes-agent.nousresearch.com/',
    },
    {
      title: 'Contabo VPS',
      subtitle: 'The Advanced Engine Room',
      description: 'A robust, always-on virtual private server for self-hosting your agent later. Fully optional—beginners can ignore this entirely.',
      iconName: 'database',
      badge: 'Advanced & Optional',
      accentColor: 'border-amber-500/30 text-amber-400 bg-amber-500/5 glow-amber',
      websiteUrl: 'https://www.tkqlhce.com/click-101775175-13796470',
    }
  ];

  const getIcon = (name: string) => {
    switch (name) {
      case 'checkSquare':
        return <CheckSquare className="w-8 h-8" />;
      case 'brain':
        return <Brain className="w-8 h-8" />;
      case 'bot':
        return <Bot className="w-8 h-8" />;
      case 'database':
        return <Database className="w-8 h-8" />;
      default:
        return <Cpu className="w-8 h-8" />;
    }
  };

  return (
    <section id="system-stack-section" className="py-24 px-6 relative overflow-hidden bg-black">
      {/* Background radial soft light for futuristic vibes */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-96 bg-radial from-amber-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide font-mono bg-neutral-900 border border-neutral-800 text-neutral-400 mb-3 uppercase">
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            The ADHD-Friendly Stack
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-extrabold text-white tracking-tight">
            Destined to Be the One <span className="text-gold-gradient font-black gold-glow-text">Technology</span> We've Waited For
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto mt-3 leading-relaxed font-light">
            Unlike rigid planners that demand massive executive effort just to organize, our core stack acts as a dynamic, non-judgmental thinking partner. It bends to fit your daily chaos and supports your execution in real-time.
          </p>
        </div>

        {/* Stack visual connector line on large screens */}
        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-[2px] bg-gradient-to-r from-rose-500/20 via-cyan-500/20 via-purple-500/20 to-amber-500/20 -translate-y-1/2 z-0" />

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {stackItems.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={`relative bg-neutral-950/95 border ${item.accentColor} p-6 sm:p-7 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300 group`}
              >
                {/* Connector dot indicator */}
                <div className="hidden lg:flex absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-black border border-neutral-800 items-center justify-center -translate-y-1/2 z-20 group-last:hidden">
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-amber-400 transition-colors" />
                </div>

                <div>
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-500">
                      {item.badge}
                    </span>
                    <span className="text-neutral-700 font-mono text-sm group-hover:text-amber-500/30 transition-colors">
                      0{idx + 1}
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="mb-5 p-3 rounded-xl bg-black w-fit border border-neutral-900 group-hover:border-amber-500/20 group-hover:text-amber-400 transition-colors duration-300">
                    {getIcon(item.iconName)}
                  </div>

                  {/* Title and Subtitle */}
                  <h3 className="text-xl font-display font-bold text-white leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs font-mono text-amber-500/80 mb-3 mt-0.5">
                    {item.subtitle}
                  </p>

                  {/* Description */}
                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {item.websiteUrl && (
                  <motion.a
                    href={item.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`mt-4 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-300 cursor-pointer ${
                      item.title === 'Todoist' 
                        ? 'text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:border-rose-400 hover:bg-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.2)] hover:shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                        : item.title === 'Hermes Agent'
                        ? 'text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.2)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                        : 'text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                    }`}
                  >
                    <span>Visit Website</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </motion.a>
                )}

                {/* Bottom interactive flare for non-technical users */}
                {item.title === 'Contabo VPS' ? (
                  <div className="mt-6 pt-4 border-t border-neutral-900/50 flex items-center gap-1.5 text-[10px] font-mono text-neutral-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>Skip this if you are a beginner!</span>
                  </div>
                ) : (
                  <div className="mt-6 pt-4 border-t border-neutral-900/50 flex items-center gap-1.5 text-[10px] font-mono text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Highly Beginner-Friendly</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
