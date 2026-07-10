import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, X, Sparkles, BookOpen, Facebook,
  Layers, Mail, Copy, Check
} from 'lucide-react';

interface FloatingMenuProps {
  onScrollToWaitlist: () => void;
}

const encode = (data: Record<string, string>) => new URLSearchParams(data).toString();

export default function FloatingMenu({ onScrollToWaitlist }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isContactSubmitted, setIsContactSubmitted] = useState(false);
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset success state when modal changes
  useEffect(() => {
    if (activeModal) {
      setIsContactSubmitted(false);
    }
  }, [activeModal]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { id: 'waitlist', label: 'Join Waitlist', icon: <Sparkles className="w-4 h-4 text-amber-500" />, action: () => { onScrollToWaitlist(); setIsOpen(false); } },
    { id: 'start', label: 'Start Here', icon: <CompassIcon />, action: () => { setActiveModal('start'); setIsOpen(false); } },
    { id: 'tutorials', label: 'Free Tutorials', icon: <BookOpen className="w-4 h-4 text-cyan-400" />, action: () => { setActiveModal('tutorials'); setIsOpen(false); } },
    { id: 'guides', label: 'Guides', icon: <Layers className="w-4 h-4 text-purple-400" />, action: () => { setActiveModal('guides'); setIsOpen(false); } },
    { id: 'products', label: 'Products', icon: <Sparkles className="w-4 h-4 text-yellow-400" />, action: () => { setActiveModal('products'); setIsOpen(false); } },
    { id: 'facebook', label: 'Facebook Group', icon: <Facebook className="w-4 h-4 text-blue-400" />, action: () => { setActiveModal('facebook'); setIsOpen(false); } },
    { id: 'contact', label: 'Contact', icon: <Mail className="w-4 h-4 text-rose-400" />, action: () => { setActiveModal('contact'); setIsOpen(false); } },
  ];

  // Mock highly practical copyable prompts for ADHD brains
  const tutorialsList = [
    {
      title: "The 'ADHD Brain Sizer' Task Chunking Prompt",
      scenario: "Use this when a project feels so massive you freeze and can't start.",
      system: "Gemini / ChatGPT / Claude",
      promptText: "Act as a shame-free ADHD productivity assistant. I want to work on [INSERT TASK], but I am experiencing intense task paralysis and freeze. Break this task down into exactly 3 sequential, physically micro-sized steps that take under 5 minutes each. Do not explain the steps. Do not write a list of 10. Just write the first 3 micro-steps in plain, encouraging language. End with: 'What is the very first step you want to tap?'"
    },
    {
      title: "The Messy Voice-to-Text Brain Organizer",
      scenario: "Dictate a completely disjointed, chaotic voice paragraph and have AI organize it into clean Todoist syntax.",
      system: "AI Assistant",
      promptText: "I am going to paste a messy, unedited transcription of my brain dump. Some are chores, some are worries, some are random creative ideas. Please extract them into two separate lists: 1) 'Todoist Tasks' (write them in Todoist natural language format, e.g., 'Draft email to Sarah tomorrow at 10am #work'), and 2) 'Reference Notes' (bullet points of details or random ideas to save). Here is my brain dump: [PASTE transcription HERE]"
    },
    {
      title: "The 'Monday Morning Reset' Micro-Routines",
      scenario: "Use this when your morning starts scattered and you are already in a spiral.",
      system: "Any LLM",
      promptText: "I am feeling extremely scattered and behind today. I need a 'Minimum Viable Routine' to reset my executive function. Give me a 3-step physical checklist. Step 1 must involve drinking water. Step 2 must involve clearing my physical desk. Step 3 must be opening my Todoist inbox. Keep the language incredibly gentle, clear, and brief. No lectures on waking up early."
    }
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactError('');
    setIsContactSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({
          'form-name': 'contact',
          name: String(formData.get('name') ?? ''),
          email: String(formData.get('email') ?? ''),
          message: String(formData.get('message') ?? ''),
          'bot-field': '',
        }),
      });

      if (!response.ok) throw new Error(`Submission failed with status ${response.status}`);
      setIsContactSubmitted(true);
    } catch (error) {
      console.error(error);
      setContactError('Your message could not be sent. Please try again in a moment.');
    } finally {
      setIsContactSubmitting(false);
    }
  };

  return (
    <div id="floating-interaction-layer" className="fixed bottom-6 right-6 z-50 flex flex-col items-end" ref={menuRef}>
      {/* 1. Main Expanded Menu Options List */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="mb-4 bg-neutral-950/95 border border-amber-500/30 p-2.5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8),_0_0_20px_rgba(212,175,55,0.15)] backdrop-blur-xl w-56 flex flex-col gap-1 overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b border-neutral-900 mb-1 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Quick Support Menu
            </div>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="flex items-center gap-3 w-full px-3 py-2 text-left text-xs text-gray-300 hover:text-white hover:bg-neutral-900 rounded-xl transition-all cursor-pointer group"
              >
                <span className="group-hover:scale-110 transition-transform">{item.icon}</span>
                <span className="font-sans font-medium">{item.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Primary Trigger Button */}
      <motion.button
        id="floating-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 rounded-full bg-gold-gradient text-neutral-950 flex items-center justify-center shadow-[0_4px_25px_rgba(212,175,55,0.35)] cursor-pointer relative group"
        aria-label={isOpen ? 'Close quick support menu' : 'Open quick support menu'}
        aria-expanded={isOpen}
      >
        {/* Pulsing neon outer gold circle */}
        <span className="absolute inset-0 rounded-full border border-amber-500/40 animate-ping opacity-75 group-hover:animate-none" />
        
        {isOpen ? (
          <X className="w-6 h-6 stroke-[2.5]" />
        ) : (
          <Menu className="w-6 h-6 stroke-[2.5]" />
        )}
      </motion.button>

      {/* 3. Action Modals layer */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-neutral-950 border border-neutral-800 p-6 sm:p-8 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto gold-glow relative"
              role="dialog"
              aria-modal="true"
              aria-label="AI for ADHD resource dialog"
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>

              {/* START HERE MODAL */}
              {activeModal === 'start' && (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-4 uppercase">
                    🧭 Vision & Compass
                  </span>
                  <h3 className="text-2xl font-display font-extrabold text-white tracking-tight mb-4">
                    The AI for ADHD Manifesto
                  </h3>
                  <div className="text-sm text-gray-300 space-y-4 leading-relaxed font-sans font-light">
                    <p>
                      Hello friend! If you have found your way here, chances are you are an ADHD adult who is feeling completely overwhelmed by standard productivity advice.
                    </p>
                    <p>
                      You are probably tired of hearing "just buy a planner," "wake up at 5:00 AM," or "push through the freeze." Standard systems are built for neurotypical brains that enjoy linear lists. They do not work for us.
                    </p>
                    <p className="border-l-2 border-amber-500 pl-4 py-1.5 text-amber-200 bg-amber-500/5 rounded-r-xl italic">
                      "We teach your systems to bend around the way your brain works—so you never have to break yourself trying to fit into them."
                    </p>
                    <p>
                      By pairing <strong>Todoist</strong> as an external brain with <strong>AI prompts</strong> as a thinking partner and <strong>Hermes Agent</strong> as an automation assistant, we build supportive scaffolding that can reduce everyday friction.
                    </p>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={() => { setActiveModal(null); onScrollToWaitlist(); }}
                      className="bg-gold-gradient text-neutral-950 font-display font-bold text-xs py-2.5 px-5 rounded-lg hover:opacity-90 transition-all cursor-pointer"
                    >
                      Join waitlist & Start Today
                    </button>
                  </div>
                </div>
              )}

              {/* FREE TUTORIALS MODAL WITH COPYABLE PROMPTS */}
              {activeModal === 'tutorials' && (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 mb-4 uppercase">
                    💡 Free Prompts & Tools
                  </span>
                  <h3 className="text-2xl font-display font-extrabold text-white tracking-tight mb-2">
                    Beginner ADHD AI Playbook
                  </h3>
                  <p className="text-xs text-neutral-400 mb-6 font-sans">
                    Tap the copy buttons below and paste these directly into Gemini, ChatGPT, or Claude to reduce friction instantly.
                  </p>

                  <div className="space-y-6">
                    {tutorialsList.map((tutorial, idx) => (
                      <div key={idx} className="border border-neutral-900 bg-neutral-950/40 p-4.5 rounded-xl space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-white font-display">
                              {tutorial.title}
                            </h4>
                            <p className="text-[11px] text-gray-400 italic mt-0.5 font-sans leading-normal">
                              {tutorial.scenario}
                            </p>
                          </div>
                          <span className="text-[9px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-500 px-2 py-0.5 rounded-md">
                            {tutorial.system}
                          </span>
                        </div>

                        {/* Copyable Box */}
                        <div className="relative bg-black rounded-lg p-3 text-xs text-amber-200/95 font-mono leading-relaxed border border-neutral-900 overflow-x-auto whitespace-pre-wrap">
                          {tutorial.promptText}
                          <button
                            onClick={() => handleCopy(tutorial.promptText, idx)}
                            className="absolute top-2 right-2 p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-gray-400 hover:text-white rounded-md transition-colors cursor-pointer"
                          >
                            {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GUIDES MODAL */}
              {activeModal === 'guides' && (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 mb-4 uppercase">
                    📚 PDF Guides Library
                  </span>
                  <h3 className="text-2xl font-display font-extrabold text-white tracking-tight mb-4">
                    Upcoming ADHD Workbooks
                  </h3>
                  <div className="space-y-4">
                    <div className="flex gap-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                      <div className="text-3xl">📓</div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Todoist for Hyperfocus</h4>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          How to configure notifications, filters, and priority flags so your to-do list doesn't trigger executive panic.
                        </p>
                        <span className="inline-block mt-2 text-[10px] font-mono text-amber-400 uppercase tracking-wider">Free for waitlist subscribers</span>
                      </div>
                    </div>
                    <div className="flex gap-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                      <div className="text-3xl">🤖</div>
                      <div>
                        <h4 className="text-sm font-bold text-white">The Prompting Blueprint for Neurodivergents</h4>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          24 plug-and-play templates designed specifically to solve email writing fatigue, meal planning, and chore sequences.
                        </p>
                        <span className="inline-block mt-2 text-[10px] font-mono text-amber-400 uppercase tracking-wider">Free for waitlist subscribers</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PRODUCTS MODAL */}
              {activeModal === 'products' && (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 mb-4 uppercase">
                    💎 Masterminds & Systems
                  </span>
                  <h3 className="text-2xl font-display font-extrabold text-white tracking-tight mb-4">
                    AI for ADHD Offerings
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                      <div className="text-2xl">👥</div>
                      <h4 className="text-sm font-bold text-white">The Mastermind Group</h4>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        A collaborative, supportive group coaching program meeting weekly to build systems, share workflows, and solve blockers live.
                      </p>
                    </div>
                    <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                      <div className="text-2xl">⚙</div>
                      <h4 className="text-sm font-bold text-white">Hermes Agent Host Pack</h4>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        A pre-configured, one-click installation script to set up Hermes Agent on a budget Contabo VPS server for continuous operations.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* FACEBOOK GROUP MODAL */}
              {activeModal === 'facebook' && (
                <div className="text-center py-6">
                  <div className="mx-auto w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mb-6 text-blue-400">
                    <Facebook className="w-8 h-8 fill-current" />
                  </div>
                  <h3 className="text-2xl font-display font-extrabold text-white tracking-tight mb-2">
                    Join Our Free Facebook Tribe
                  </h3>
                  <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed mb-6 font-sans">
                    The AI for ADHD community space is being prepared now. Join the waitlist and we will send the official group link when doors open.
                  </p>
                  <button
                    onClick={() => { setActiveModal(null); onScrollToWaitlist(); }}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-sans font-semibold py-3 px-6 rounded-xl cursor-pointer shadow-lg transition-all"
                  >
                    <Facebook className="w-4 h-4 fill-current" />
                    Get the Group Link
                  </button>
                </div>
              )}

              {/* CONTACT MODAL */}
              {activeModal === 'contact' && (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20 mb-4 uppercase">
                    ✉ Reach Out
                  </span>
                  <h3 className="text-2xl font-display font-extrabold text-white tracking-tight mb-2">
                    Have a question or just want to say hi?
                  </h3>
                  
                  {isContactSubmitted ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-8 space-y-4"
                    >
                      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Check className="w-6 h-6" />
                      </div>
                      <h4 className="text-lg font-bold text-white">Message Dispatched!</h4>
                      <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                        We have captured your thoughts safely. Our neurodivergent-friendly support team will reply to you shortly.
                      </p>
                      <button 
                        onClick={() => setActiveModal(null)}
                        className="mt-4 border border-neutral-800 hover:border-amber-500/20 text-xs px-4 py-2 rounded-xl text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Close Window
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <p className="text-xs text-neutral-400 mb-6 font-sans">
                        Drop us a message and our team (mostly humans, supported by friendly bots) will get back to you!
                      </p>

                      <form name="contact" method="POST" data-netlify="true" data-netlify-honeypot="bot-field" onSubmit={handleContactSubmit} className="space-y-4">
                        <input type="hidden" name="form-name" value="contact" />
                        <p className="hidden" aria-hidden="true"><label>Do not fill this out: <input name="bot-field" tabIndex={-1} /></label></p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="contact-name" className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1.5">Your Name</label>
                            <input id="contact-name" name="name" type="text" required autoComplete="name" placeholder="Alex" className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-base text-white outline-none focus:border-amber-500/40" />
                          </div>
                          <div>
                            <label htmlFor="contact-email" className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1.5">Your Email</label>
                            <input id="contact-email" name="email" type="email" required autoComplete="email" placeholder="alex@email.com" className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-base text-white outline-none focus:border-amber-500/40" />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="contact-message" className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1.5">Message</label>
                          <textarea id="contact-message" name="message" required rows={4} placeholder="What is on your mind? No shame, write as much or as little as you like..." className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-base text-white outline-none focus:border-amber-500/40"></textarea>
                        </div>
                        {contactError && <p role="alert" className="text-red-300 text-xs text-center">{contactError}</p>}
                        <button type="submit" disabled={isContactSubmitting} className="w-full bg-gold-gradient text-neutral-950 font-display font-bold py-3 px-5 rounded-lg hover:opacity-90 transition-all cursor-pointer text-xs disabled:opacity-60">
                          {isContactSubmitting ? 'Sending…' : 'Send Message'}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CompassIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
