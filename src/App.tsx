import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  BrainCircuit, 
  Heart, 
  ArrowUp, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Phone, 
  PhoneOff,
  Settings,
  Terminal, 
  Star, 
  MessageSquare, 
  Database,
  Check,
  RefreshCw,
  HelpCircle,
  Clock,
  ShieldAlert
} from 'lucide-react';

// Subcomponents
import InteractiveBrainLogo from './components/InteractiveBrainLogo';
import TypingRotation from './components/TypingRotation';

import BelongSection from './components/BelongSection';
import LegalModals from './components/LegalModals';
import ParallaxStars from './components/ParallaxStars';
import VoiceCallManager, { CallState } from './components/VoiceCallManager';
import { connectWorkspace, createLiveAuthTicket, disconnectWorkspace, getWorkspaceStatus, initAuth, googleSignIn, logout, WorkspaceIntegration, WorkspaceStatus } from './lib/firebase';

const logoImg = "https://subpagebucket.s3.eu-north-1.amazonaws.com/library/934/8efcf85b-cc3a-42b7-a2e5-168705e77dab.png";

const workspaceIntegrations: Array<{ key: WorkspaceIntegration; label: string; description: string }> = [
  { key: 'tasks', label: 'Tasks', description: 'Create task lists, subtasks, and geofenced reminders.' },
  { key: 'calendar', label: 'Calendar', description: 'Create focus blocks and review upcoming events.' },
  { key: 'drive_docs', label: 'Drive & Docs', description: 'Save note cards and write brainstorms into Docs.' },
];

export default function App() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const quillSectionRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  // Voice call state
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userVolume, setUserVolume] = useState(0);
  const [quillVolume, setQuillVolume] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<any>(null);

  // Google Workspace Authentication state
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>({ connected: false });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [connectingIntegration, setConnectingIntegration] = useState<WorkspaceIntegration | null>(null);

  // Geofenced Locations state
  const [locations, setLocations] = useState<any[]>(() => {
    const saved = localStorage.getItem('quill_locations');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Office', lat: 37.7749, lng: -122.4194, radius: 100 },
      { id: '2', name: 'Home', lat: 37.7833, lng: -122.4167, radius: 100 },
      { id: '3', name: 'Grocery Store', lat: 37.7694, lng: -122.4464, radius: 100 }
    ];
  });
  const [newLocName, setNewLocName] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');
  const [newLocRadius, setNewLocRadius] = useState('100');

  // Reminders and logs state
  const [geofenceReminders, setGeofenceReminders] = useState<any[]>(() => {
    const saved = localStorage.getItem('quill_geofences');
    return saved ? JSON.parse(saved) : [];
  });
  const [voiceLogs, setVoiceLogs] = useState<any[]>([]);

  // Post-call feedback state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<boolean>(false);

  // Load remaining daily seconds from server entitlement route
  const loadEntitlement = async () => {
    try {
      const res = await fetch('/api/quill/entitlement');
      const data = await res.json();
      setEntitlement(data);
      if (data.remainingSeconds !== undefined && callState === 'idle') {
        setTimeRemaining(data.remainingSeconds);
      }
    } catch (err) {
      console.error("[Entitlement] Failed to fetch usage limits:", err);
    }
  };

  useEffect(() => {
    loadEntitlement();
    // Track scroll height to show back to top
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);

    // Initialize Google Auth listener
    const unsubscribe = initAuth(
      (user, status) => {
        setGoogleUser(user);
        setWorkspaceStatus(status);
      },
      () => {
        setGoogleUser(null);
        setWorkspaceStatus({ connected: false });
      }
    );

    const workspaceResult = new URLSearchParams(window.location.search).get('workspace');
    if (workspaceResult === 'connected') {
      setTimeout(() => refreshWorkspaceStatus(), 500);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else if (workspaceResult === 'error') {
      setErrorMessage('Google Workspace connection failed. Please try connecting again.');
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubscribe();
    };
  }, []);

  // Save locations to localStorage automatically
  useEffect(() => {
    localStorage.setItem('quill_locations', JSON.stringify(locations));
  }, [locations]);

  // Save geofences to localStorage automatically
  useEffect(() => {
    localStorage.setItem('quill_geofences', JSON.stringify(geofenceReminders));
  }, [geofenceReminders]);

  // Request call start and obtain session permission from backend
  const handleCallButtonClick = async () => {
    if (callState === 'active' || callState === 'connecting' || callState === 'requesting-permission') {
      setIsVoiceCallOpen(false);
      setCallState('idle');
      if (sessionId) {
        // Formally end session on server
        await fetch('/api/quill/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        }).catch(() => {});
      }
      loadEntitlement();
      // Prompt for feedback after a successful call
      if (voiceLogs.length > 0 || timeRemaining < 290) {
        setShowFeedbackForm(true);
      }
      return;
    }

    setErrorMessage(null);
    setShowFeedbackForm(false);
    setFeedbackSuccess(false);
    setFeedbackRating(0);
    setFeedbackText('');

    try {
      setCallState('connecting');
      const res = await fetch('/api/quill/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Daily limit reached or active session running.');
      }

      setSessionId(data.sessionId);
      setTimeRemaining(data.remainingSeconds || 300);
      setIsVoiceCallOpen(true);
    } catch (err: any) {
      console.error("[Session] Init failed:", err);
      setErrorMessage(err.message || 'Could not initiate voice session.');
      setCallState('error');
    }
  };

  const handleStateChange = (state: CallState) => {
    setCallState(state);
    if (state === 'ended') {
      setIsVoiceCallOpen(false);
      loadEntitlement();
      if (voiceLogs.length > 0 || timeRemaining < 290) {
        setShowFeedbackForm(true);
      }
    }
  };

  const handleEndCall = () => {
    setIsVoiceCallOpen(false);
    loadEntitlement();
    if (voiceLogs.length > 0 || timeRemaining < 290) {
      setShowFeedbackForm(true);
    }
  };

  // Handle live tool response logs from Gemini Live speech stream
  const handleToolExecuted = (msg: any) => {
    const { toolExecuted, args, result } = msg;
    const timestamp = new Date().toLocaleTimeString();
    let description = '';

    if (toolExecuted === 'add_reminders' && result?.success) {
      const g = result.geofence;
      description = `Geofenced reminder set for "${args.task_text}" at "${g.location}" (${g.lat.toFixed(4)}, ${g.lng.toFixed(4)})`;
      setGeofenceReminders(prev => [
        {
          id: result.task?.id || Math.random().toString(),
          taskText: args.task_text,
          location: g.location,
          lat: g.lat,
          lng: g.lng,
          radius: g.radius,
          trigger: g.trigger,
          timestamp: new Date().toLocaleString()
        },
        ...prev
      ]);
    } else if (toolExecuted === 'add_google_tasks' && result?.success) {
      const count = result.tasks?.length || 0;
      description = `Batch created ${count} Google Tasks: "${args.tasks.map((t: any) => t.content).join(', ')}"`;
    } else if (toolExecuted === 'get_workspace_overview') {
      const taskCount = result.tasks?.length || 0;
      const eventCount = result.calendarEvents?.length || 0;
      description = `Retrieved Workspace Overview: ${taskCount} active Google Tasks, ${eventCount} today's Calendar events`;
    } else if (toolExecuted === 'create_calendar_event' && result?.success) {
      description = `Scheduled Google Calendar Event: "${result.summary}" starting at ${new Date(result.startTime).toLocaleTimeString()}`;
    } else if (toolExecuted === 'write_google_doc' && result?.success) {
      description = `Saved thoughts to Google Doc "${result.title}" (Document ID: ${result.documentId})`;
    } else if (toolExecuted === 'manage_keep_notes' && result?.success) {
      if (args.action === 'get') {
        description = `Retrieved ${result.notes?.length || 0} Keep note cards from Google Drive`;
      } else {
        description = `Saved ${result.count || 0} Keep note cards back to Google Drive`;
      }
    } else {
      description = `Executed tool ${toolExecuted} - response received.`;
    }

    setVoiceLogs(prev => [
      {
        id: Math.random().toString(),
        tool: toolExecuted,
        description,
        timestamp
      },
      ...prev
    ]);
  };

  // Google login & logout helper functions
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const user = await googleSignIn();
      setGoogleUser(user);
      await refreshWorkspaceStatus();
    } catch (err: any) {
      console.error('Login failed:', err);
      setErrorMessage(err.message || 'Google Sign-In failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConnectWorkspace = async (integration: WorkspaceIntegration) => {
    setConnectingIntegration(integration);
    setErrorMessage(null);
    try {
      await connectWorkspace([integration]);
    } catch (err: any) {
      console.error('Workspace authorization failed:', err);
      setErrorMessage(err.message || 'Google Workspace authorization failed.');
      setConnectingIntegration(null);
    }
  };

  const handleDisconnectWorkspace = async () => {
    try {
      await disconnectWorkspace();
      await refreshWorkspaceStatus();
    } catch (err: any) {
      console.error('Workspace disconnect failed:', err);
      setErrorMessage(err.message || 'Could not disconnect Google Workspace.');
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logout();
      setGoogleUser(null);
      setWorkspaceStatus({ connected: false });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const refreshWorkspaceStatus = async () => {
    try {
      const status = await getWorkspaceStatus();
      setWorkspaceStatus(status);
    } catch {
      setWorkspaceStatus({ connected: false });
    }
  };

  // Add custom geofenced locations manually
  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName || !newLocLat || !newLocLng) return;
    const latNum = parseFloat(newLocLat);
    const lngNum = parseFloat(newLocLng);
    const radNum = parseInt(newLocRadius) || 100;

    if (isNaN(latNum) || isNaN(lngNum)) {
      alert("Coordinates must be valid numbers.");
      return;
    }

    const newLoc = {
      id: Date.now().toString(),
      name: newLocName.trim(),
      lat: latNum,
      lng: lngNum,
      radius: radNum
    };

    setLocations(prev => [...prev, newLoc]);
    setNewLocName('');
    setNewLocLat('');
    setNewLocLng('');
    setNewLocRadius('100');
  };

  const handleRemoveLocation = (id: string) => {
    setLocations(prev => prev.filter(loc => loc.id !== id));
  };

  // Submit session feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedbackRating === 0) return;
    setIsSubmittingFeedback(true);

    try {
      const res = await fetch('/api/quill/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          feedbackText,
          sessionId
        })
      });

      if (res.ok) {
        setFeedbackSuccess(true);
        setTimeout(() => {
          setShowFeedbackForm(false);
          setFeedbackSuccess(false);
          setFeedbackRating(0);
          setFeedbackText('');
        }, 2500);
      }
    } catch (err) {
      console.error("[Feedback] Error submitting:", err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Formatting remaining time in a beautifully responsive clock
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-scroll logic helper
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const startCallTrigger = () => {
    scrollToSection('quill-playground');
    setTimeout(() => {
      handleCallButtonClick();
    }, 400);
  };

  const connectedIntegrations = new Set(workspaceStatus.connectedIntegrations || []);

  return (
    <div className="relative min-h-screen bg-[#050505] text-gray-100 overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200 selection:font-medium">
      
      {/* 1. Dynamic Rainbow Top Border Indicator */}
      <div className="fixed top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-cyan-400 via-purple-500 via-pink-500 via-orange-400 via-yellow-300 to-green-500 z-[60]" />

      {/* 2. Starscape Visual Backdrops */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <ParallaxStars />
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #D4AF37 0%, transparent 75%)' }} />
        <div className="absolute top-[-5%] left-[25%] w-[45vw] h-[45vw] rounded-full bg-purple-500/5 blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '16s' }} />
        <div className="absolute bottom-[15%] right-[5%] w-[35vw] h-[35vw] rounded-full bg-blue-500/5 blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '20s' }} />
      </div>

      {/* 3. Sticky Responsive Header Navigation */}
      <header className="fixed top-[3px] left-0 right-0 w-full z-50 py-4 px-6 sm:px-12 border-b border-white/5 backdrop-blur-md bg-black/80 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand Logo & Smooth scroll to top */}
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3.5 select-none cursor-pointer group">
            <div className="relative w-11 h-11 flex items-center justify-center rounded-full bg-black border-2 border-[#D4AF37]/45 shadow-[0_0_15px_rgba(212,175,55,0.35)] group-hover:scale-105 group-hover:border-[#D4AF37] transition-transform duration-300 overflow-hidden">
              <div className="absolute inset-0.5 rounded-full bg-amber-500/10 blur-[3px]" />
              <img
                src={logoImg}
                alt="AI for ADHD Icon"
                className="w-8 h-8 object-contain relative z-10 select-none drop-shadow-[0_0_8px_rgba(212,175,55,0.45)] group-hover:drop-shadow-[0_0_15px_rgba(212,175,55,0.65)] group-hover:scale-110 transition-all duration-300"
              />
            </div>
            <div className="hidden sm:block">
              <span className="font-display font-black text-sm tracking-widest text-white block group-hover:text-amber-400 transition-colors">QUILL</span>
              <span className="font-mono text-[9px] text-gray-500 uppercase tracking-widest">ADHD BODY DOUBLE</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold tracking-wider uppercase text-gray-400 font-sans">
            <button onClick={() => scrollToSection('quill-playground')} className="hover:text-amber-400 transition-colors">Call Quill</button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-amber-400 transition-colors">How it works</button>
            <button onClick={() => scrollToSection('body-doubling')} className="hover:text-amber-400 transition-colors">Body Doubling</button>
            <button onClick={() => scrollToSection('beta-info')} className="hover:text-amber-400 transition-colors">Open Beta</button>
            <a href="https://blog.aiforadhd.xyz/" className="hover:text-amber-400 transition-colors">Blog</a>
          </nav>

          {/* Call CTA Badge */}
          <div className="flex items-center gap-4">
            <button
              onClick={startCallTrigger}
              className="border border-[#D4AF37] text-[#D4AF37] px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-[#D4AF37] hover:text-black transition-all shadow-[0_0_10px_rgba(212,175,55,0.2)] cursor-pointer"
            >
              STUCK? CALL QUILL
            </button>
          </div>

        </div>
      </header>

      {/* 4. HERO INTRODUCTION */}
      <section className="relative pt-32 pb-16 px-6 md:pt-36 md:pb-24 z-10">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          
          <div className="mb-2 relative">
            {/* Visual Backlight Ring scaling to microphone volume */}
            <div 
              style={{ transform: `translate(-50%, -50%) scale(${1 + (userVolume + quillVolume) * 0.12})` }}
              className="absolute top-[40%] left-[50%] w-72 h-72 rounded-full bg-amber-500/[0.04] blur-2xl transition-transform duration-100 ease-out pointer-events-none" 
            />
            <InteractiveBrainLogo />
          </div>

          <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-amber-400/90 mb-4 bg-amber-500/5 border border-amber-500/20 px-3.5 py-1 rounded-full shadow-[0_0_12px_rgba(212,175,55,0.05)]">
            🎙️ ON-DEMAND ADHD AUDIO BODY DOUBLE
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-white max-w-3xl leading-[1.1] mb-6">
            Stuck? <span className="text-gold-gradient font-black gold-glow-text">Call Quill.</span>
          </h1>

          <div className="mb-10 w-full max-w-lg">
            <TypingRotation />
          </div>

          <p className="text-gray-300 text-sm sm:text-base md:text-lg max-w-2xl font-light leading-relaxed mb-8">
            When executive dysfunction makes starting feel impossible, don't write lists or organize calendars. Just talk. Quill is a highly responsive audio partner built specifically to clear neurodivergent freezing and find one clear immediate step together.
          </p>

          <button
            onClick={startCallTrigger}
            className="bg-gold-gradient text-neutral-950 font-display font-black tracking-wider text-sm px-8 py-4 rounded-xl shadow-[0_4px_25px_rgba(212,175,55,0.35)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center gap-2.5"
          >
            <Phone className="w-4 h-4" /> START FREE CALL NOW
          </button>

          <p className="text-neutral-500 text-xs mt-4 italic font-sans max-w-sm">
            "No login. No configuration. Just connect, speak the chaos, and gain instant momentum."
          </p>

        </div>
      </section>

      {/* 5. CORE INTERACTIVE CALL WORKSPACE (/#quill) */}
      <section id="quill-playground" ref={quillSectionRef} className="py-16 px-6 relative z-10 border-t border-white/5 bg-neutral-950/20">
        <div className="max-w-4xl mx-auto space-y-10">
          
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
              Quill Voice Call Interface
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm max-w-xl mx-auto">
              Speak freely without feeling overwhelmed. Our AI body double is live right now inside your browser. Complete your 5-minute daily session to unlock your tasks.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Primary Live Audio Controller */}
            <div className="lg:col-span-7 bg-neutral-950/60 border border-neutral-900 rounded-3xl p-6 sm:p-8 relative shadow-2xl overflow-hidden gold-glow flex flex-col items-center justify-center min-h-[360px]">
              
              {/* Dynamic Aura behind Call Manager */}
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.02),transparent_70%)]" />

              <div className="space-y-6 w-full text-center relative z-10 flex flex-col items-center">
                
                {/* Visual Status Indicator */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      callState === 'active' ? 'bg-emerald-500 animate-ping' :
                      callState === 'connecting' ? 'bg-amber-400 animate-pulse' :
                      callState === 'requesting-permission' ? 'bg-blue-400 animate-pulse' :
                      'bg-neutral-600'
                    }`} />
                    <span className="font-mono text-[10px] font-bold tracking-widest text-gray-300 uppercase">
                      {callState === 'idle' ? 'DISCONNECTED' : callState}
                    </span>
                  </div>
                  {callState === 'active' && (
                    <span className="text-[10px] font-mono text-emerald-400 mt-1">
                      Gemini Live Zephyr Voice Connected
                    </span>
                  )}
                </div>

                {/* Animated Waves representing volume scaling */}
                <div className="h-16 flex items-center justify-center gap-1.5 w-full max-w-xs">
                  {callState === 'active' ? (
                    Array.from({ length: 15 }).map((_, i) => {
                      // Alternate between user volume and quill volume
                      const scaleVal = i % 2 === 0 ? userVolume : quillVolume;
                      const h = 4 + (scaleVal * 45) + (Math.sin(i * 0.5) * 8);
                      return (
                        <motion.div
                          key={i}
                          animate={{ height: Math.max(4, h) }}
                          transition={{ type: 'spring', stiffness: 220, damping: 15 }}
                          className={`w-1 rounded-full ${i % 2 === 0 ? 'bg-cyan-500' : 'bg-amber-400'}`}
                        />
                      );
                    })
                  ) : (
                    <div className="h-px bg-neutral-800 w-4/5" />
                  )}
                </div>

                {/* Large Call Trigger Button */}
                <button
                  onClick={handleCallButtonClick}
                  className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 relative cursor-pointer group ${
                    callState === 'active' || callState === 'connecting'
                      ? 'bg-red-500/10 border-2 border-red-500/40 hover:bg-red-500/20 text-red-400'
                      : 'bg-gold-gradient text-neutral-950 hover:opacity-90 shadow-[0_0_20px_rgba(212,175,55,0.15)]'
                  }`}
                >
                  {callState === 'active' || callState === 'connecting' ? (
                    <>
                      <PhoneOff className="w-7 h-7 mb-1" />
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider">END CALL</span>
                    </>
                  ) : (
                    <>
                      <Phone className="w-7 h-7 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider">CALL</span>
                    </>
                  )}
                  {callState === 'active' && (
                    <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
                  )}
                </button>

                {/* Timer Countdown */}
                <div className="space-y-2">
                  <div className="font-mono text-3xl font-bold tracking-wider text-white">
                    {formatTime(timeRemaining)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                    Session Duration Remaining
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2 justify-center">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Quota Progress Bar */}
                <div className="w-full space-y-1.5 pt-4">
                  <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                    <span>ANONYMOUS BETA VISITOR QUOTA</span>
                    <span>{timeRemaining} / 300 SECONDS LEFT</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 transition-all duration-1000"
                      style={{ width: `${(timeRemaining / 300) * 100}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-neutral-500 text-left">
                    Your daily 5-minute quota resets automatically at midnight. Absolutely no registration required.
                  </div>
                </div>

              </div>

              {/* Headless VoiceCallManager Integration */}
              <VoiceCallManager
                isOpen={isVoiceCallOpen}
                sessionId={sessionId}
                onStateChange={handleStateChange}
                onTimeRemainingChange={setTimeRemaining}
                onVolumeChange={(u, q) => {
                  setUserVolume(u);
                  setQuillVolume(q);
                }}
                onError={setErrorMessage}
                onEnd={handleEndCall}
                getWorkspaceAuthTicket={createLiveAuthTicket}
                locations={locations}
                onToolExecuted={handleToolExecuted}
              />

            </div>

            {/* Side Column: Workspace Sync & Config Settings */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Google Workspace Integration Panel */}
              <div className="bg-neutral-950/60 border border-neutral-900 rounded-3xl p-6 relative shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Google Workspace Sync
                    </h3>
                  </div>
                </div>

                <p className="text-gray-400 text-xs leading-relaxed mb-4">
                  Sign in with Google first, then choose exactly which Workspace services Quill can use for task capture, calendar blocking, note cards, and Docs brainstorming.
                </p>

                {/* Connection Status Badge */}
                <div className="flex items-center gap-2 mb-4 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                  <div className={`w-2 h-2 rounded-full ${workspaceStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-neutral-600'}`} />
                  <span className="text-[10px] font-mono text-gray-300">
                    {googleUser ? `Signed in as ${workspaceStatus.email || googleUser.email || googleUser.displayName || 'Google user'}` : 'Signed out'}
                  </span>
                </div>

                {!googleUser ? (
                  <div className="space-y-4 pt-2 border-t border-white/5">
                    <button
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="w-full bg-white text-neutral-950 font-sans font-bold text-xs py-2.5 px-4 rounded-xl shadow-md hover:bg-neutral-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoggingIn ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-neutral-600" />
                          <span>AUTHENTICATING...</span>
                        </>
                      ) : (
                        <>
                          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 mr-1">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          </svg>
                          <span>Sign in with Google</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2 border-t border-white/5">
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono tracking-wider text-gray-400 uppercase">
                        Workspace Integrations
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {workspaceIntegrations.map((integration) => {
                          const enabled = connectedIntegrations.has(integration.key);
                          const isConnecting = connectingIntegration === integration.key;
                          return (
                            <div key={integration.key} className="border border-white/10 bg-white/[0.03] rounded-xl p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-xs text-gray-200">
                                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${enabled ? 'text-green-500' : 'text-neutral-600'}`} />
                                    <span className="font-bold">{integration.label}</span>
                                  </div>
                                  <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
                                    {integration.description}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleConnectWorkspace(integration.key)}
                                  disabled={isConnecting}
                                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-mono transition-colors cursor-pointer ${
                                    enabled
                                      ? 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10'
                                      : 'bg-amber-400 text-neutral-950 hover:bg-amber-300'
                                  } disabled:opacity-60`}
                                >
                                  {isConnecting ? 'OPENING...' : enabled ? 'EXPAND' : 'CONNECT'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={handleDisconnectWorkspace}
                        disabled={!workspaceStatus.connected}
                        className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-300 font-mono text-xs py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        DISCONNECT WORKSPACE
                      </button>
                      <button
                        onClick={handleGoogleLogout}
                        className="w-full bg-transparent border border-white/10 hover:bg-white/5 text-neutral-400 font-mono text-xs py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        SIGN OUT
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>

          {/* Feedback Form Modal Overlay / Post-Call Action Cards */}
          <AnimatePresence>
            {showFeedbackForm && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-neutral-950/90 border-2 border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative max-w-2xl mx-auto"
              >
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => setShowFeedbackForm(false)}
                    className="text-neutral-500 hover:text-white"
                  >
                    &times; Close
                  </button>
                </div>

                <form onSubmit={handleSubmitFeedback} className="space-y-6 text-center">
                  <div className="mx-auto w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <MessageSquare className="w-5 h-5 animate-pulse" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xl font-display font-extrabold text-white">
                      How was your session with Quill?
                    </h3>
                    <p className="text-gray-400 text-xs">
                      Help us refine this ADHD body-double. Share your honest, shame-free feedback.
                    </p>
                  </div>

                  {/* Interactively Glowing Star Selector */}
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="p-1 focus:outline-none transition-transform active:scale-90"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= (hoveredRating || feedbackRating)
                              ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_#D4AF37]'
                              : 'text-neutral-700'
                          } transition-all`}
                        />
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <textarea
                      placeholder="Was Quill patient? Did they help break down the freeze? Any weird audio silence issues? (Optional)"
                      rows={3}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-3 px-4 text-xs text-gray-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={feedbackRating === 0 || isSubmittingFeedback}
                    className="w-full bg-gold-gradient text-neutral-950 font-display font-bold py-3 rounded-xl disabled:opacity-50 text-xs sm:text-sm shadow-md cursor-pointer transition-all uppercase"
                  >
                    {isSubmittingFeedback ? 'SUBMITTING...' : 'SUBMIT SHAME-FREE FEEDBACK'}
                  </button>

                  {feedbackSuccess && (
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-2 rounded-xl flex items-center gap-1.5 justify-center">
                      <Check className="w-4 h-4" />
                      <span>Thank you! Your feedback has been saved.</span>
                    </div>
                  )}
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Underlay Output: Real-time logs */}
          <div className="pt-4">
            
            {/* Live Terminal Log Stream */}
            <div className="bg-neutral-950/60 border border-neutral-900 rounded-3xl p-5 shadow-xl flex flex-col h-[280px]">
              <div className="flex items-center justify-between border-b border-neutral-900 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-mono tracking-widest text-gray-300 uppercase font-bold">
                    Quill Live Action Logs
                  </span>
                </div>
                <span className="text-[9px] font-mono text-neutral-600">PCM STREAM LIVE</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 font-mono text-[11px] text-gray-400 text-left pr-1">
                {voiceLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-neutral-600 py-10 space-y-2">
                    <Clock className="w-5 h-5 opacity-60" />
                    <span>No actions recorded. Initiate a call and speak to Quill to stream tool feedback here.</span>
                  </div>
                ) : (
                  voiceLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-[#D4AF37] pl-2.5 py-0.5 space-y-0.5">
                      <div className="flex justify-between text-[9px] text-neutral-500">
                        <span className="text-[#D4AF37] uppercase font-bold">{log.tool}</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <p className="text-gray-300 leading-relaxed text-xs">{log.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. HOW IT WORKS SECTION (/#how-it-works) */}
      <section id="how-it-works" className="py-24 px-6 relative overflow-hidden bg-neutral-950/15">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/10 to-transparent" />
        
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
              Traditional productivity was built for <span className="text-gold-gradient font-black gold-glow-text">linear brains</span>. <br />
              Quill is built for you.
            </h2>
            <p className="text-gray-400 text-base max-w-2xl mx-auto font-light leading-relaxed">
              When standard lists fail and calendars cause guilt, try speaking. We bypass the friction of the "start state" by giving you an active verbal partner to filter out the noise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="bg-neutral-950/40 border border-neutral-900/60 p-8 rounded-3xl relative space-y-4 shadow-md">
              <span className="text-4xl">🎙️</span>
              <h3 className="text-lg font-bold text-white">1. Speak the Chaos</h3>
              <p className="text-gray-400 text-xs leading-relaxed font-light">
                Click call, accept mic permissions, and talk. You don't need to speak clearly or structure your thoughts. Spill the raw, messy soup of what is freeze-framing your brain.
              </p>
            </div>

            <div className="bg-neutral-950/40 border border-neutral-900/60 p-8 rounded-3xl relative space-y-4 shadow-md">
              <span className="text-4xl">⚡</span>
              <h3 className="text-lg font-bold text-white">2. Quill Extracts the Step</h3>
              <p className="text-gray-400 text-xs leading-relaxed font-light">
                Quill listens with absolute patience and empathy. Using the custom Gemini Live SDK, the assistant filters out the overwhelm, ignores rigid deadlines, and identifies exactly <em>one</em> stupidly small 5-minute action to begin.
              </p>
            </div>

            <div className="bg-neutral-950/40 border border-neutral-900/60 p-8 rounded-3xl relative space-y-4 shadow-md">
              <span className="text-4xl">🎯</span>
              <h3 className="text-lg font-bold text-white">3. Synced Automatically</h3>
              <p className="text-gray-400 text-xs leading-relaxed font-light">
                Quill proactively calls the Todoist integration. Your new task, nested checklists, or geofenced coordinate reminders are created instantly inside your real account, ready to go whenever you are.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 7. NEUROSCIENCE & BODY DOUBLING BENEFITS (/#body-doubling) */}
      <section id="body-doubling" className="py-24 px-6 relative overflow-hidden border-t border-white/5 bg-black/40">
        <div className="max-w-4xl mx-auto space-y-16">
          
          <div className="text-center space-y-4">
            <div className="inline-block">
              <span className="text-[10px] font-mono tracking-widest text-[#D4AF37] uppercase bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full shadow-[0_0_8px_rgba(212,175,55,0.1)] animate-pulse">
                🔬 THE NEUROSCIENCE OF MOMENTUM
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
              Why Body-Doubling Works
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed font-light">
              ADHD task paralysis is not a failure of character or willpower. It is a neurological roadblock in executive regulation. A "body double" bridges that gap.
            </p>
          </div>

          <div className="bg-gradient-to-r from-neutral-950 via-neutral-900/40 to-neutral-950 border border-neutral-800/60 rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 bottom-0 left-0 w-[4px] bg-gradient-to-b from-cyan-400 via-purple-500 to-pink-500" />
            
            <div className="space-y-6 text-gray-300 text-xs sm:text-sm leading-relaxed font-sans font-light">
              <p className="text-base sm:text-lg text-white font-medium leading-normal italic">
                “Having another calm, non-judgmental entity present—even virtually—reduces the cortical noise that causes freeze states. It acts as a cognitive scaffold, letting the ADHD brain transition into execution.”
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">The Cortical Brake</h4>
                  <p className="text-gray-400">
                    ADHD brains struggle with dopamine regulation, which governs task transitions. When a task is ambiguous or daunting, the brain registers it as a threat, locking you in "paralysis." Quill bypasses this by breaking down ambiguity verbally in real-time.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Zero Judgment, Total Flow</h4>
                  <p className="text-gray-400">
                    Traditional body doubling relies on other humans, which introduces social anxiety, performance pressure, or scheduling friction. Quill is always available, endlessly patient, completely free of shame, and hyper-focused on your momentum.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 8. OPEN BETA & PRIVACY MATTERS (/#beta-info) */}
      <section id="beta-info" className="py-24 px-6 relative overflow-hidden border-t border-white/5 bg-neutral-950/25">
        <div className="max-w-4xl mx-auto space-y-12">
          
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
              Secure, Private Open Beta
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm max-w-xl mx-auto font-light leading-relaxed">
              We operate with a simple, strict code of honor regarding your cognitive data. Read our parameters transparently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="border border-neutral-900 bg-black/60 p-6 rounded-2xl space-y-3 text-left">
              <span className="text-2xl">⏳</span>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">300s Daily Quota</h4>
              <p className="text-neutral-500 text-[11px] leading-relaxed">
                Anonymous visitors receive 300 seconds of active calling daily to distribute server loads. Verified and reset authorizations are managed entirely securely on our backend.
              </p>
            </div>

            <div className="border border-neutral-900 bg-black/60 p-6 rounded-2xl space-y-3 text-left">
              <span className="text-2xl">🔒</span>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Absolute Privacy</h4>
              <p className="text-neutral-500 text-[11px] leading-relaxed">
                We track analytical event timestamps to optimize server loads, but we <strong>NEVER</strong> store, transmit, or record any audio files, transcripts, or personal conversation context.
              </p>
            </div>

            <div className="border border-neutral-900 bg-black/60 p-6 rounded-2xl space-y-3 text-left">
              <span className="text-2xl">📍</span>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Local Storage Stored</h4>
              <p className="text-neutral-500 text-[11px] leading-relaxed">
                Your custom coordinate locations and completed lists are saved exclusively in your browser’s local storage. Your credentials never hit our server logs.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 9. PORTAL INFRASTRUCTURE CTAS & DEEPER CAPSULES (Honeydepot placeholder / hidden member controls) */}
      <div className="hidden border border-neutral-800 p-8 text-center max-w-md mx-auto rounded-3xl" id="hidden-portal-auth">
        {/* Keeps account infrastructure and Firebase bindings intact behind the scenes for potential future use */}
        <h3 className="font-bold text-neutral-500">System Core Authenticator Ready</h3>
        <p className="text-xs text-neutral-600">Secure Token Exchanger: {workspaceStatus.connected ? 'Active' : 'Empty'}</p>
      </div>

      {/* 10. COMPASSIONATE FOOTER & LEGAL MODALS */}
      <footer className="border-t border-white/5 py-12 px-6 sm:px-12 bg-black text-xs text-neutral-400 z-10 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Quotes */}
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

          {/* Right: Disclaimer and Contacts */}
          <div className="lg:col-span-4 lg:text-right space-y-4">
            <p className="font-mono text-[10px] text-neutral-500 tracking-wider uppercase">
              Built for ADHD brains, with absolute respect for your executive battery.
            </p>
            <p className="font-sans font-light text-[11px] text-neutral-500 leading-normal max-w-md lg:ml-auto">
              Quill and AI for ADHD do not make medical claims, prescriptions, or diagnostic statements. AI is presented solely as a supportive cognitive scaffold.
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

      {/* Floating Action Call Button (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-10 h-10 rounded-full bg-neutral-950/90 border border-neutral-800 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer shadow-lg transition-colors backdrop-blur-sm"
            >
              <ArrowUp className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

      </div>

      {/* Legal pages modals */}
      <LegalModals 
        isOpen={legalModalType !== null} 
        onClose={() => setLegalModalType(null)} 
        type={legalModalType} 
      />

    </div>
  );
}
