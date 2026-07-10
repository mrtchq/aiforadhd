import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Compass, BrainCircuit, Heart, ArrowUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

// Subcomponents
import InteractiveBrainLogo from './components/InteractiveBrainLogo';
import TypingRotation from './components/TypingRotation';
import CountdownTimer from './components/CountdownTimer';
import WaitlistForm from './components/WaitlistForm';
import CardGrid from './components/CardGrid';
import SystemStack from './components/SystemStack';
import ClarityTimeline from './components/ClarityTimeline';
import BelongSection from './components/BelongSection';
import MembersPortal from './components/MembersPortal';
import LegalModals from './components/LegalModals';

// Firebase helper
import { initAuth, checkIsSignInLink, completeSignInWithLink } from './lib/firebase';

// @ts-ignore
import logoImg from './components/logo.png';

interface StardustNode {
  id: number;
  top: string;
  left: string;
  size: string;
  delay: string;
  duration: string;
}

export default function App() {
  const waitlistRef = useRef<HTMLDivElement>(null);
  const [stardust, setStardust] = useState<StardustNode[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentView, setCurrentView] = useState<'landing' | 'portal'>('landing');
  
  // Auth state shared with portal
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [magicLinkMessage, setMagicLinkMessage] = useState<{ text: string; type: 'success' | 'error' | 'loading' } | null>(null);
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  // Initialize Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Check for Passwordless Magic Sign-In Link on Mount
  useEffect(() => {
    const handlePasswordlessLink = async () => {
      if (checkIsSignInLink(window.location.href)) {
        setCurrentView('portal'); // Take them directly to the portal view
        setMagicLinkMessage({ text: 'Processing your magic sign-in link...', type: 'loading' });
        
        let email = window.localStorage.getItem('emailForSignIn') || new URL(window.location.href).searchParams.get('email');
        
        if (!email) {
          const userEmailInput = window.prompt("To complete secure passwordless sign-in, please confirm your email address:");
          if (userEmailInput) {
            email = userEmailInput.trim();
          } else {
            setMagicLinkMessage({ text: "Email confirmation is required to complete passwordless sign-in.", type: 'error' });
            return;
          }
        }
        
        try {
          const loggedUser = await completeSignInWithLink(email, window.location.href);
          setUser(loggedUser);
          setAccessToken('local-session');
          setMagicLinkMessage({ text: "Unlocking workspace... Welcome to your private elite capsule!", type: 'success' });
          
          // Clear query params elegantly from the browser address bar without reload
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch (err: any) {
          console.error("Failed to complete passwordless sign-in", err);
          setMagicLinkMessage({ 
            text: err.message || "Failed to complete passwordless login. The link may have expired or was already used.", 
            type: 'error' 
          });
        }
      }
    };
    
    handlePasswordlessLink();
  }, []);

  // Scroll to waitlist target
  const scrollToWaitlist = () => {
    if (waitlistRef.current) {
      waitlistRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Generate lightweight random star background particles on mount
  useEffect(() => {
    const particles: StardustNode[] = Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 2 + 1}px`,
      delay: `${Math.random() * 10}s`,
      duration: `${Math.random() * 12 + 8}s`,
    }));
    setStardust(particles);

    // Track scroll position to show scroll to top button
    const handleScroll = () => {
      if (window.scrollY > 800) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (currentView === 'portal') {
    return (
      <MembersPortal
        onBack={() => setCurrentView('landing')}
        user={user}
        accessToken={accessToken}
        magicLinkMessage={magicLinkMessage}
        clearMagicLinkMessage={() => setMagicLinkMessage(null)}
        onLoginSuccess={(u, t) => {
          setUser(u);
          setAccessToken(t);
        }}
        onLogoutSuccess={() => {
          setUser(null);
          setAccessToken(null);
        }}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#050505] text-gray-100 overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200 selection:font-medium">
      
      {/* Immersive Theme: Top Rainbow Gradient Indicator */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-cyan-400 via-purple-500 via-pink-500 via-orange-400 via-yellow-300 to-green-500 z-50" />

      {/* A. Animated Stars/Stardust Layer (ADHD-friendly, calm visual depth) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {stardust.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-amber-400/40"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              boxShadow: '0 0 6px rgba(212,175,55,0.3)',
              animation: `float-around ${star.duration} infinite ease-in-out`,
              animationDelay: star.delay,
              opacity: 0.5,
            }}
          />
        ))}
        {/* Immersive Theme: Golden central halo aura */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #D4AF37 0%, transparent 70%)' }}></div>
        {/* Soft rotating gradients representing background light movement */}
        <div className="absolute top-[-10%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-purple-500/5 blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '14s' }} />
        <div className="absolute bottom-[20%] right-[10%] w-[40vw] h-[40vw] rounded-full bg-blue-500/5 blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '18s' }} />
      </div>

      {/* B. Navigation Wordmark Header */}
      <header className="sticky top-0 w-full z-50 py-4 px-6 sm:px-12 border-b border-white/5 backdrop-blur-md bg-black/80 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo Wordmark */}
          <div onClick={handleScrollToTop} className="flex items-center gap-3.5 select-none cursor-pointer group">
            <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-black border-2 border-[#D4AF37]/45 shadow-[0_0_15px_rgba(212,175,55,0.35)] group-hover:scale-105 group-hover:border-[#D4AF37] transition-transform duration-300 overflow-hidden">
              {/* Subtle gold backdrop glow */}
              <div className="absolute inset-0.5 rounded-full bg-amber-500/10 blur-[3px]" />
              
              {/* Golden Shimmer Sweep */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div
                  initial={{ x: '-150%' }}
                  animate={{ x: '150%' }}
                  transition={{
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: 3.5,
                    ease: "easeInOut",
                    repeatDelay: 1.5
                  }}
                  className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-amber-400/20 to-transparent skew-x-12"
                />
              </div>

              {/* Beautiful Brain Logo Icon */}
              <img
                src={logoImg}
                alt="AI for ADHD Icon"
                referrerPolicy="no-referrer"
                className="w-9 h-9 object-contain relative z-10 select-none drop-shadow-[0_0_8px_rgba(212,175,55,0.45)] group-hover:drop-shadow-[0_0_15px_rgba(212,175,55,0.65)] group-hover:scale-110 transition-all duration-300"
              />
            </div>
            <span className="font-display font-extrabold text-lg tracking-tight text-white flex items-center">
              AI for <span className="text-gold-gradient gold-glow-text font-black pl-1">ADHD</span>
            </span>
          </div>

          {/* Quick Header Badge */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> SYSTEM STATUS: OPTIMIZED
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(212,175,55,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              WAITLIST ACTIVE
            </span>
            <button
              onClick={() => setCurrentView('portal')}
              className="hidden sm:inline-block border border-[#D4AF37] text-[#D4AF37] px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-[#D4AF37] hover:text-black transition-all shadow-[0_0_10px_rgba(212,175,55,0.2)] cursor-pointer"
            >
              {user ? "ENTER PORTAL" : "MEMBER'S PORTAL"}
            </button>
          </div>
        </div>
      </header>

      {/* C. HERO SECTION */}
      <section id="hero-section" className="relative pt-12 pb-24 px-6 md:pt-16 md:pb-32 z-10">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          
          {/* 1. Core Visual Inspiration Brain Logo */}
          <div className="mb-6">
            <InteractiveBrainLogo />
          </div>

          {/* 2. Eyebrow */}
          <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-amber-400/90 mb-4 bg-amber-500/5 border border-amber-500/20 px-3.5 py-1 rounded-full shadow-[0_0_12px_rgba(212,175,55,0.05)]">
            🚀 AI SYSTEMS FOR ADHD BRAINS
          </span>

          {/* 3. Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-white max-w-3xl leading-[1.1] mb-6">
            Make ADHD Life Feel <br className="hidden sm:inline" />
            <span className="text-gold-gradient font-black gold-glow-text">Less Chaotic</span> With AI
          </h1>

          {/* 4. Smooth Animated Typing Line below headline */}
          <div className="mb-10 w-full max-w-lg">
            <TypingRotation />
          </div>

          {/* 5. Subheadline */}
          <p className="text-gray-300 text-sm sm:text-base md:text-lg max-w-2xl font-light leading-relaxed mb-6">
            Learn simple, beginner-friendly ways to use AI, Todoist, and automation to brain dump, plan your day, break down tasks, build routines, and get unstuck.
          </p>

          {/* 6. Supporting compassionate line */}
          <p className="text-neutral-500 text-xs sm:text-sm italic max-w-md mb-12 font-sans">
            "No tech background needed. No perfect routine required. No shame if you’ve started over a hundred times."
          </p>

          {/* 7. Live Countdown Indicator */}
          <div className="mb-14">
            <CountdownTimer />
          </div>

          {/* 8. Waitlist Subscription Card */}
          <div ref={waitlistRef} className="w-full scroll-mt-24">
            <WaitlistForm />
          </div>

        </div>
      </section>

      {/* D. "WHAT THIS HELPS WITH" SECTION */}
      <CardGrid />

      {/* E. "THE AI FOR ADHD SYSTEM" SECTION */}
      <SystemStack />

      {/* F. "THREE WEEKS OF C.L.A.R.I.T.Y." SECTION */}
      <ClarityTimeline />

      {/* G. "YOU BELONG HERE" SECTION */}
      <BelongSection />

      {/* H. FINAL CALL-TO-ACTION (CTA) SECTION */}
      <section id="final-cta-section" className="py-28 px-6 relative overflow-hidden bg-gradient-to-b from-black to-neutral-950">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 text-amber-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-extrabold text-white tracking-tight mb-4">
            Start With <span className="text-gold-gradient font-black gold-glow-text">One Small Step</span>
          </h2>

          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-10">
            Join the free waitlist and get practical AI for ADHD tutorials, prompts, workflows, and launch updates.
          </p>

          <button
            onClick={scrollToWaitlist}
            className="bg-gold-gradient hover:opacity-90 active:scale-95 text-neutral-950 font-display font-bold py-4 px-8 rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.25)] inline-flex items-center gap-2 cursor-pointer transition-all duration-300"
          >
            Join the Free Waitlist
          </button>
        </div>
      </section>

      {/* I. COMPASSIONATE FOOTER */}
      <footer className="border-t border-white/5 py-12 px-6 sm:px-12 bg-black text-xs text-neutral-400 z-10 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Quote & Tag bubbles */}
          <div className="lg:col-span-8 space-y-4 text-left">
            <p className="text-[#D4AF37] font-serif italic text-lg sm:text-xl leading-snug border-l-2 border-[#D4AF37]/30 pl-4">
              “Your brain is not broken. The system just needs to be built differently.”
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-[9px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 border border-white/5 uppercase">Task Paralysis</span>
              <span className="text-[9px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 border border-white/5 uppercase">Brain Dumps</span>
              <span className="text-[9px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 border border-white/5 uppercase">Time Blindness</span>
              <span className="text-[9px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 border border-white/5 uppercase">Decision Fatigue</span>
            </div>
          </div>

          {/* Right Column: Status & Copyright */}
          <div className="lg:col-span-4 lg:text-right space-y-4">
            <p className="font-mono text-[10px] text-neutral-500 tracking-wider uppercase">
              Built for ADHD brains, with absolute respect for your cognitive battery.
            </p>
            <p className="font-sans font-light text-[11px] text-neutral-500 leading-normal max-w-md lg:ml-auto">
              AI for ADHD does not make medical claims or diagnostic statements. AI is presented solely as a supportive cognitive scaffold.
            </p>
            <p className="font-mono text-[11px] text-[#D4AF37] font-bold tracking-wider uppercase">
              Support: CONTACT US: SUPPORT@AIFORADHD.XYZ
            </p>
            <div className="pt-4 text-neutral-600 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between lg:justify-end gap-3 sm:gap-6">
              <div className="flex gap-4">
                <button 
                  onClick={() => setLegalModalType('privacy')} 
                  className="hover:text-amber-400 transition-colors cursor-pointer text-[11px] font-sans underline decoration-white/10 underline-offset-4"
                >
                  Privacy Policy
                </button>
                <button 
                  onClick={() => setLegalModalType('terms')} 
                  className="hover:text-amber-400 transition-colors cursor-pointer text-[11px] font-sans underline decoration-white/10 underline-offset-4"
                >
                  Terms of Service
                </button>
              </div>
              <div className="flex gap-4 text-[11px]">
                <span>© 2026 AI for ADHD</span>
                <span>All rights reserved</span>
              </div>
            </div>
          </div>

        </div>
      </footer>

      {/* J. UTILITY INTERACTIVE FLOATING ELEMENTS */}

      {/* Legal pages modals */}
      <LegalModals 
        isOpen={legalModalType !== null} 
        onClose={() => setLegalModalType(null)} 
        type={legalModalType} 
      />

      {/* Floating Scroll to Top trigger */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleScrollToTop}
            className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-neutral-950/80 border border-neutral-800 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer shadow-lg transition-colors z-40 backdrop-blur-sm"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
