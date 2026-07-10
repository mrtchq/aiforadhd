import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, User, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { WaitlistItem } from '../types';

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [subCount, setSubCount] = useState(134); // Starting subscriber number for dopamine momentum
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Read previous submissions count
    const saved = localStorage.getItem('ai_for_adhd_waitlist');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WaitlistItem[];
        setSubCount(134 + parsed.length);
        // Check if current user is already subscribed
        const isAlreadySubbed = localStorage.getItem('ai_for_adhd_subscribed');
        if (isAlreadySubbed) {
          setIsSubmitted(true);
          const savedUser = JSON.parse(isAlreadySubbed);
          setName(savedUser.name || '');
          setEmail(savedUser.email || '');
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please provide your email address to join.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please provide a valid email address so we can reach you.');
      return;
    }

    setIsSubmitting(true);

    // Simulate standard, smooth network submission
    setTimeout(() => {
      const newSubscriber: WaitlistItem = {
        email: email.trim(),
        name: name.trim() || undefined,
        timestamp: new Date().toISOString()
      };

      // Read current list
      let currentList: WaitlistItem[] = [];
      const saved = localStorage.getItem('ai_for_adhd_waitlist');
      if (saved) {
        try {
          currentList = JSON.parse(saved);
        } catch (e) {
          currentList = [];
        }
      }

      // Add to list if not duplicate email
      const exists = currentList.some(item => item.email.toLowerCase() === newSubscriber.email.toLowerCase());
      if (!exists) {
        currentList.push(newSubscriber);
        localStorage.setItem('ai_for_adhd_waitlist', JSON.stringify(currentList));
      }

      // Mark user as subscribed in this browser session
      localStorage.setItem('ai_for_adhd_subscribed', JSON.stringify(newSubscriber));
      
      setSubCount(134 + currentList.length);
      setIsSubmitted(true);
      setIsSubmitting(false);
    }, 1200);
  };

  return (
    <div id="waitlist-card-wrapper" className="w-full max-w-xl mx-auto px-4">
      <AnimatePresence mode="wait">
        {!isSubmitted ? (
          <motion.div
            key="signup-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="relative bg-black border-2 border-amber-500/35 p-8 sm:p-10 rounded-2xl shadow-[0_0_30px_rgba(212,175,55,0.18)] overflow-hidden"
          >
            {/* Luxurious Golden Shimmer Sweep */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              <motion.div
                initial={{ x: '-150%' }}
                animate={{ x: '150%' }}
                transition={{
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 4.5,
                  ease: "easeInOut",
                  repeatDelay: 1.5
                }}
                className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-amber-500/15 to-transparent skew-x-12"
              />
            </div>

            {/* Subtle golden top border highlight */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-amber-500/80 to-transparent" />
            
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                Join the Free Waitlist
              </span>
              <h3 className="text-2xl sm:text-3xl font-display font-black text-gold-gradient gold-glow-text tracking-tight">
                Claim Your Spot Today
              </h3>
              <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
                No subscription fee. No complex setup. Just actionable strategies sent directly to your inbox.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field (Beginner friendly & Warm) */}
              <div className="relative group">
                <label htmlFor="name-input" className="block text-xs font-mono font-medium text-amber-400/80 uppercase tracking-wider mb-1.5 ml-1">
                  First Name <span className="text-neutral-600 font-sans text-[10px] lowercase italic">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-neutral-500 group-focus-within:text-amber-400 transition-colors">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="name-input"
                    type="text"
                    placeholder="Your first name (e.g., Alex)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/80 border border-amber-500/20 focus:border-amber-500/70 rounded-xl py-3 pl-10 pr-4 text-white placeholder-neutral-700 outline-none text-sm transition-all focus:ring-2 focus:ring-amber-500/15"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="relative group">
                <label htmlFor="email-input" className="block text-xs font-mono font-medium text-amber-400/80 uppercase tracking-wider mb-1.5 ml-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-neutral-500 group-focus-within:text-amber-400 transition-colors">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="email-input"
                    type="email"
                    required
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/80 border border-amber-500/20 focus:border-amber-500/70 rounded-xl py-3 pl-10 pr-4 text-white placeholder-neutral-700 outline-none text-sm transition-all focus:ring-2 focus:ring-amber-500/15"
                  />
                </div>
              </div>

              {/* Error block */}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-xs font-mono bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg text-center"
                >
                  {error}
                </motion.p>
              )}

              {/* CTA Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full relative overflow-hidden bg-gold-gradient hover:opacity-90 active:scale-[0.98] text-neutral-950 font-display font-semibold py-3.5 px-6 rounded-xl text-center shadow-[0_4px_20px_rgba(212,175,55,0.25)] flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 group mt-6 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-neutral-950" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Securing your spot...
                  </span>
                ) : (
                  <>
                    Join Waitlist
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Social Proof / Momentum Indicator */}
            <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-amber-500/15 text-xs text-neutral-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Join <strong className="text-amber-400 font-semibold">{subCount}</strong> ADHD brains in the queue</span>
            </div>

            {/* Microcopy under form */}
            <p className="text-neutral-500 text-[11px] leading-relaxed text-center mt-4 max-w-sm mx-auto">
              Get beginner-friendly AI prompts, Todoist workflows, Hermes Agent tutorials, and practical systems built for real life.
            </p>
          </motion.div>
        ) : (
          /* High-Dopamine ADHD Friendly Success State */
          <motion.div
            key="success-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-black border-2 border-amber-500/50 p-8 sm:p-10 rounded-2xl text-center shadow-[0_0_40px_rgba(212,175,55,0.25)] relative overflow-hidden"
          >
            {/* Luxurious Golden Shimmer Sweep */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              <motion.div
                initial={{ x: '-150%' }}
                animate={{ x: '150%' }}
                transition={{
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 4.5,
                  ease: "easeInOut",
                  repeatDelay: 1.5
                }}
                className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-amber-500/15 to-transparent skew-x-12"
              />
            </div>

            {/* Confetti light flare effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-amber-500/80 to-transparent" />

            <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-amber-400" />
            </div>

            <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
              {name ? `Welcome to the movement, ${name}! 🎉` : "You're Officially In! 🎉"}
            </h3>

            <p className="text-gray-400 text-sm mt-3 max-w-md mx-auto leading-relaxed">
              You are subscriber <span className="text-amber-400 font-mono font-bold">#{subCount}</span>! We are absolutely thrilled to have you here. Your brain is not broken—you just needed a system built differently.
            </p>

            {/* ADHD Action Encouragement Box */}
            <div className="my-6 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 text-left max-w-md mx-auto space-y-3.5">
              <h4 className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> What to expect next:
              </h4>
              <ul className="text-xs text-gray-300 space-y-2 font-sans">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">✔</span>
                  <span><strong>July 13th:</strong> The "Three Weeks of C.L.A.R.I.T.Y." series launches. Watch your inbox for your Day 1 guide.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">✔</span>
                  <span><strong>Free Gifts:</strong> Custom ADHD prompts for ChatGPT/Gemini will arrive in your welcome email shortly.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">✔</span>
                  <span><strong>No Guilt:</strong> If you miss an email, delete it. Zero shame. Pick up whenever you have the focus.</span>
                </li>
              </ul>
            </div>

            {/* Simple Reset button if they signed up in error or want to change details */}
            <button
              onClick={() => {
                localStorage.removeItem('ai_for_adhd_subscribed');
                setIsSubmitted(false);
                setEmail('');
              }}
              className="text-xs text-neutral-500 hover:text-amber-400 underline font-mono transition-colors"
            >
              Change Email / Register another brain
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
