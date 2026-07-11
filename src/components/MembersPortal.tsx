import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  LogOut, 
  Folder, 
  FolderPlus, 
  FileText, 
  CheckCircle, 
  Brain, 
  ExternalLink, 
  Lock, 
  Compass, 
  Terminal, 
  Sparkles, 
  Cpu, 
  Server, 
  CheckSquare, 
  Search, 
  ArrowLeft, 
  AlertCircle, 
  Database, 
  RefreshCw, 
  Play, 
  Copy,
  ChevronRight,
  Plus,
  ArrowRight
} from 'lucide-react';
import { googleSignIn, logout } from '../lib/firebase';

interface MembersPortalProps {
  onBack: () => void;
  user: any;
  accessToken: string | null;
  magicLinkMessage?: { text: string; type: 'success' | 'error' | 'loading' } | null;
  clearMagicLinkMessage?: () => void;
  onLoginSuccess: (user: any, token: string | null) => void;
  onLogoutSuccess: () => void;
}


interface PremiumPrompt {
  id: string;
  title: string;
  tagline: string;
  icon: React.ReactNode;
  promptText: string;
  explanation: string;
}

export default function MembersPortal({ 
  onBack, 
  user, 
  accessToken, 
  magicLinkMessage,
  clearMagicLinkMessage,
  onLoginSuccess, 
  onLogoutSuccess 
}: MembersPortalProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'prompts' | 'hermes' | 'system'>('dashboard');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  // Mind Declutterer Assistant States
  const [unstructuredThoughts, setUnstructuredThoughts] = useState('');
  const [optimizedPlan, setOptimizedPlan] = useState<{
    oneBigThing: string;
    momentumTasks: string[];
    microPlan: string[];
    todoistSyntax: string[];
  } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isExportingPlan, setIsExportingPlan] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Todoist Checklist States
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    const saved = localStorage.getItem('adhd_portal_checklist');
    return saved ? JSON.parse(saved) : [];
  });

  const handleLogout = async () => {
    try {
      await logout();
      onLogoutSuccess();
      setOptimizedPlan(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  // Simulating ADHD Brain Optimization with state-of-the-art interactive prompt responder
  const handleOptimizeThoughts = () => {
    if (!unstructuredThoughts.trim()) return;
    setIsOptimizing(true);
    setOptimizedPlan(null);

    // Simulate high-fidelity structured analysis optimized for ADHD brains (instant structured microstep decomposition)
    setTimeout(() => {
      const raw = unstructuredThoughts.toLowerCase();
      
      let oneBigThing = "Decompress and Clear Open Loops";
      let momentumTasks = ["Gather notebook & draft inbox", "Drink a tall glass of cool water"];
      let microPlan = [
        "Empty your immediate working memory by brain-dumping all outstanding loop files.",
        "Choose the item with highest psychological friction and split it into 3 sub-steps.",
        "Set an egg timer for exactly 12 minutes to initiate single-task flow state.",
        "Mark completed items immediately to trigger dopamine feedback loop."
      ];
      let todoistSyntax = [
        "Inbox Clean Reset @ADHD_Focus p1",
        "12-Minute Brain Sweep @Hermes_Flow p2 due today",
        "Momentum Launchpad @Moments p3"
      ];

      // Smart customization based on keywords
      if (raw.includes('laundry') || raw.includes('clean') || raw.includes('house') || raw.includes('room')) {
        oneBigThing = "Clear Physical Workspace Path (The laundry / room friction)";
        momentumTasks = ["Sort exactly 5 items of clothing", "Put laundry on quick-cycle mode"];
        microPlan = [
          "Pick up clothes that are strictly on the bed/floor and put them into a basket.",
          "Identify one comfortable chair to keep completely clear of clothes today.",
          "Set an audio alarm for 10 minutes, play a high-energy lo-fi track.",
          "Walk away immediately once the timer goes off—no pressure to do the entire room."
        ];
        todoistSyntax = [
          "Load laundry quick wash @ADHD_Momentum p1",
          "Clear bed surface space (10-min timer) @Space_Setup p2",
          "Fold exactly 5 items of laundry @Low_Energy p3"
        ];
      } else if (raw.includes('meeting') || raw.includes('work') || raw.includes('email') || raw.includes('write') || raw.includes('project')) {
        oneBigThing = "Prepare Meeting Starter Outline";
        momentumTasks = ["Open the document/email tab", "Write exactly one header line"];
        microPlan = [
          "Close all distracting browser tabs except the meeting/project window.",
          "Draft three core keywords about what you want to achieve in this session.",
          "Create a structured placeholder template: 'Goal', 'My Role', 'Next Steps'.",
          "Schedule a brief 5-minute break immediately after outline submission."
        ];
        todoistSyntax = [
          "Draft 3-point meeting outline @ADHD_Focus p1 due today",
          "Close unused desktop browser tabs @Clear_Space p2",
          "Draft quick follow-up draft @Low_Energy p3"
        ];
      } else if (raw.includes('bill') || raw.includes('pay') || raw.includes('admin') || raw.includes('phone') || raw.includes('call')) {
        oneBigThing = "Address Administrative Friction Item";
        momentumTasks = ["Locate the reference bill number", "Open the payment portal tab"];
        microPlan = [
          "Copy-paste the necessary payment link to your browser.",
          "Input billing information instantly—rely on password manager to reduce typing friction.",
          "Capture the payment receipt in a clear, labeled email folder.",
          "Reward yourself with an immediate executive reward (quick walk, high-dopamine break)."
        ];
        todoistSyntax = [
          "Pay critical bill item @ADHD_Admin p1 due today",
          "Save bill receipt pdf @System_Audit p2",
          "High-dopamine 5-minute break @Reward p3"
        ];
      }

      setOptimizedPlan({
        oneBigThing,
        momentumTasks,
        microPlan,
        todoistSyntax
      });
      setIsOptimizing(false);
    }, 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const toggleChecklistStep = (step: string) => {
    setCompletedSteps(prev => {
      const next = prev.includes(step) ? prev.filter(item => item !== step) : [...prev, step];
      localStorage.setItem('adhd_portal_checklist', JSON.stringify(next));
      return next;
    });
  };

  const handleExportPlanToWorkspace = async () => {
    if (!optimizedPlan) return;
    try {
      setIsExportingPlan(true);
      const exportText = [
        `THE ONE BIG THING: ${optimizedPlan.oneBigThing}`,
        '',
        'MOMENTUM SPARKS:',
        ...optimizedPlan.momentumTasks.map(task => `- ${task}`),
        '',
        'MICRO-PLAN:',
        ...optimizedPlan.microPlan.map((task, index) => `${index + 1}. ${task}`),
        '',
        'TODOIST SYNTAX:',
        ...optimizedPlan.todoistSyntax.map(task => `- ${task}`),
      ].join('\n');

      await navigator.clipboard.writeText(exportText);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } finally {
      setIsExportingPlan(false);
    }
  };

  const premiumPrompts: PremiumPrompt[] = [
    {
      id: 'brain_dump',
      title: 'The ADHD Chaos Un-shredder',
      tagline: 'Transforms messy, circular brain loops into high-momentum next actions.',
      icon: <Brain className="w-5 h-5 text-cyan-400" />,
      promptText: `Act as my executive assistant who deeply understands ADHD brains, task paralysis, and dopamine deficits.
I will paste an unedited, chaotic brain dump of tasks, worries, and half-formed ideas.
Please perform the following steps:
1. Identify "The One Big Thing": The task with the highest psychological friction or impact today.
2. Formulate "Momentum Sparks": exactly 2 tasks that take less than 3 minutes to complete.
3. Build a "Micro-Step Plan": Break the rest of the dump into small, extremely low-friction tasks. Focus on micro-progress (e.g., "Open the document" instead of "Write the report").
4. Formulate the Todoist task syntax with labels and priorities.
Keep your response short, encouraging, entirely shame-free, and highly scannable (bold spacing).`,
      explanation: 'Use this when your mind is overflowing with dozens of tabs open and you feel frozen.'
    },
    {
      id: 'task_paralysis',
      title: 'The Task Paralysis Shrinker',
      tagline: 'Shrinks giant intimidating projects into digestible, dopamine-rewarding micro-steps.',
      icon: <Sparkles className="w-5 h-5 text-amber-400" />,
      promptText: `I am currently experiencing intense task paralysis and freeze-response regarding [INSERT PROJECT/TASK HERE].
My brain is magnifying this task, making it feel impossible to start.
Please help me break it down into tiny, low-friction micro-actions. 
Give me:
- A "Level 1" action (e.g. sit at your desk, touch the paper, open the tab).
- A "Level 2" action that requires zero intellectual effort (e.g. type a random sentence).
- A customized Todoist workflow to capture the progress safely.
Remember: Do not tell me to 'just do it'. Break it down so small that my brain stops resisting.`,
      explanation: 'Use this when you are staring at a task for hours or days, completely unable to make yourself begin.'
    },
    {
      id: 'daily_reset',
      title: 'The ADHD 10-Minute Reset',
      tagline: 'An elegant template to clear physical and digital clutter without exhaustion.',
      icon: <Compass className="w-5 h-5 text-emerald-400" />,
      promptText: `I need a structured but flexible "10-Minute Reset Guide" for my physical room/workspace and open tabs.
The rules:
1. I am allowed to play 3 high-energy songs.
2. I must stop the moment the music ends.
Generate a checklist of extremely sensory, quick tasks I can tackle sequentially:
- Clear the nearest visual path.
- Close 5 tabs.
- Place immediate hydration within reach.
Keep the tone energetic, playful, and focused on momentum rather than perfection.`,
      explanation: 'Perfect for mid-day slumps when your working space feels cluttered and noisy.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col relative overflow-hidden">
      {/* Decorative Rainbow Line Accent (Inspired by Brain logo colors) */}
      <div className="fixed top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-cyan-400 via-purple-500 via-pink-500 via-orange-400 to-amber-500 z-50" />
      
      {/* Absolute Ambient Background Lights */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      
      {/* Top Portal Nav Bar */}
      <nav className="border-b border-amber-500/10 backdrop-blur-xl bg-black/70 fixed top-[3px] left-0 right-0 z-40 px-6 py-3.5 sm:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 rounded-xl border border-neutral-800 hover:border-amber-500/30 hover:bg-neutral-900/60 transition-all duration-200 group text-neutral-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="flex items-center gap-2 select-none">
              <span className="text-xs font-mono tracking-widest text-amber-500/80 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full uppercase">Exclusive Access</span>
              <span className="font-display font-extrabold text-sm sm:text-base text-white tracking-tight">
                MEMBER'S <span className="text-gold-gradient font-black gold-glow-text">PORTAL</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 bg-black/60 border border-amber-500/15 px-3 py-2 rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.06)]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 p-[1.5px] shrink-0">
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#050505] flex items-center justify-center">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'Member'} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p className="text-xs font-medium text-white truncate max-w-[140px]">{user.displayName || 'ADHD Brain'}</p>
                  <p className="text-[10px] font-mono text-amber-400/80 uppercase tracking-[0.18em]">Signed in with Google</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="ml-1 inline-flex items-center gap-2 rounded-xl bg-neutral-950/80 border border-amber-500/15 px-3 py-2 text-xs font-semibold text-neutral-200 hover:text-white hover:border-amber-400/40 hover:bg-neutral-900 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={async () => {
                  try {
                    setError(null);
                    setIsLoggingIn(true);
                    const result = await googleSignIn();
                    if (result) {
                      onLoginSuccess(result.user, result.accessToken);
                    }
                  } catch (err: any) {
                    setError(err?.message || 'Google Sign-In failed.');
                  } finally {
                    setIsLoggingIn(false);
                  }
                }}
                className="bg-gold-gradient text-neutral-950 font-display font-bold text-xs py-2 px-4 rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 pt-24 md:pt-28 relative z-10 flex flex-col">
        
        {/* Gate Wall if user is not authenticated */}
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="gate-wall"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto py-12 text-center"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400/10 to-amber-600/5 border-2 border-amber-500/40 rounded-full flex items-center justify-center mb-6 shadow-[0_0_35px_rgba(212,175,55,0.2)]">
                <Lock className="w-9 h-9 text-amber-400 animate-pulse" />
              </div>

              <h2 className="text-3xl sm:text-4xl font-display font-black text-gold-gradient gold-glow-text mb-3">
                The Luxury ADHD Workspace
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-xl">
                Sign in with Google to access the member portal.
              </p>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setError(null);
                    setIsLoggingIn(true);
                    const result = await googleSignIn();
                    if (result) {
                      onLoginSuccess(result.user, result.accessToken);
                    }
                  } catch (err: any) {
                    setError(err?.message || 'Google Sign-In failed.');
                  } finally {
                    setIsLoggingIn(false);
                  }
                }}
                disabled={isLoggingIn}
                className="bg-gold-gradient text-neutral-950 font-display font-bold py-3 px-5 rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isLoggingIn ? 'Opening Google...' : 'Continue with Google'}
              </button>

              {error && (
                <div className="w-full bg-red-950/40 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl flex items-center gap-2 mt-6 text-xs text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="leading-normal">{error}</span>
                </div>
              )}
            </motion.div>
          ) : (
            // Full Workspace Portal Content
            <motion.div 
              key="workspace-portal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8"
            >
              {/* Sidebar Navigation */}
              <div className="lg:col-span-1 flex flex-col gap-2">
                <div className="bg-black/40 border border-amber-500/10 p-4 rounded-2xl mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 p-[1.5px] shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                      <div className="w-full h-full bg-[#050505] rounded-full flex items-center justify-center overflow-hidden">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-amber-400" />
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm tracking-tight truncate max-w-[130px]">{user.displayName || 'ADHD Explorer'}</h3>
                      <p className="text-[10px] font-mono text-amber-500/80">
                        {user.storageType ? `Sync: ${user.storageType}` : 'Premium Ready'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full text-left py-3 px-4 rounded-xl font-display text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${
                    activeTab === 'dashboard' 
                      ? 'bg-gradient-to-r from-amber-500/15 to-transparent border-l-2 border-amber-500 text-amber-400' 
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
                  }`}
                >
                  <Compass className="w-4 h-4 shrink-0" />
                  <span>Executive Dashboard</span>
                </button>

                <button
                  onClick={() => setActiveTab('prompts')}
                  className={`w-full text-left py-3 px-4 rounded-xl font-display text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${
                    activeTab === 'prompts' 
                      ? 'bg-gradient-to-r from-amber-500/15 to-transparent border-l-2 border-amber-500 text-amber-400' 
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>ADHD Prompts Hub</span>
                </button>

                <button
                  onClick={() => setActiveTab('hermes')}
                  className={`w-full text-left py-3 px-4 rounded-xl font-display text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${
                    activeTab === 'hermes' 
                      ? 'bg-gradient-to-r from-amber-500/15 to-transparent border-l-2 border-amber-500 text-amber-400' 
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
                  }`}
                >
                  <Terminal className="w-4 h-4 shrink-0" />
                  <span>Mind Declutterer AI</span>
                </button>

                <button
                  onClick={() => setActiveTab('system')}
                  className={`w-full text-left py-3 px-4 rounded-xl font-display text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${
                    activeTab === 'system' 
                      ? 'bg-gradient-to-r from-amber-500/15 to-transparent border-l-2 border-amber-500 text-amber-400' 
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900/40'
                  }`}
                >
                  <Cpu className="w-4 h-4 shrink-0" />
                  <span>The System Stack</span>
                </button>
              </div>

              {/* Central Dynamic Content Area */}
              <div className="lg:col-span-3 flex flex-col bg-neutral-950/40 border border-amber-500/10 p-6 sm:p-8 rounded-2xl min-h-[500px]">
                
                {/* Magic Link Notification Banner */}
                {magicLinkMessage && (
                  <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    magicLinkMessage.type === 'success' 
                      ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : magicLinkMessage.type === 'error'
                      ? 'bg-red-950/40 border-red-500/20 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                      : 'bg-amber-950/40 border-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                  }`}>
                    <div className="flex items-center gap-2">
                      {magicLinkMessage.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />}
                      {magicLinkMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
                      {magicLinkMessage.type === 'loading' && <RefreshCw className="w-4 h-4 shrink-0 text-amber-400 animate-spin" />}
                      <span className="leading-relaxed">{magicLinkMessage.text}</span>
                    </div>
                    {clearMagicLinkMessage && (
                      <button 
                        onClick={clearMagicLinkMessage} 
                        className="text-neutral-400 hover:text-white font-mono font-bold px-1.5 py-0.5 rounded transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}

                {/* Notification Banner */}

                {/* TAB 1: DASHBOARD */}
                {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                    <div className="border-b border-amber-500/10 pb-4 mb-4">
                      <h2 className="text-2xl font-display font-black text-gold-gradient tracking-tight">ADHD Executive Workspace</h2>
                      <p className="text-neutral-400 text-xs mt-1">A shame-free hub built specifically to reduce mental friction and sustain momentum.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-black/40 border border-amber-500/15 p-5 rounded-2xl shadow-[0_0_15px_rgba(212,175,55,0.03)]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Workspace Status</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <h4 className="text-2xl font-display font-bold text-white mb-1">
                          Ready
                        </h4>
                        <p className="text-neutral-500 text-[11px]">
                          Workspace is connected
                        </p>
                      </div>

                      <div className="bg-black/40 border border-amber-500/15 p-5 rounded-2xl shadow-[0_0_15px_rgba(212,175,55,0.03)]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Mental Reset Code</span>
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                        </div>
                        <h4 className="text-2xl font-display font-bold text-white mb-1">Ready</h4>
                        <p className="text-neutral-500 text-[11px]">Chaos Un-shredder prompt is updated</p>
                      </div>

                      <div className="bg-black/40 border border-amber-500/15 p-5 rounded-2xl shadow-[0_0_15px_rgba(212,175,55,0.03)]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Todoist Workspace</span>
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        </div>
                        <h4 className="text-2xl font-display font-bold text-white mb-1">C.L.A.R.I.T.Y.</h4>
                        <p className="text-neutral-500 text-[11px]">Progress tracked inside setup guide</p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/5 to-transparent border border-amber-500/15 p-6 rounded-2xl mt-8 relative overflow-hidden">
                      <div className="absolute right-[-30px] bottom-[-30px] opacity-10">
                        <Brain className="w-48 h-48 text-[#D4AF37]" />
                      </div>
                      <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full uppercase mb-4 inline-block">Welcome Affirmation</span>
                      <h4 className="text-lg font-display font-bold text-white mb-2">"No shame if you've started over a hundred times."</h4>
                      <p className="text-gray-400 text-xs sm:text-sm leading-relaxed max-w-xl">
                        Productivity advice written for typical brains often adds guilt. In this exclusive portal, your goal is not to be a perfect organizer. Your goal is simply to build external scaffolding (Todoist, workspace files, prompts) that catch you when executive function fails.
                      </p>
                    </div>

                    <div className="pt-4">
                      <h3 className="font-display font-bold text-sm text-neutral-300 mb-3 uppercase tracking-wider font-mono text-[10px]">Your Core Path</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div onClick={() => setActiveTab('hermes')} className="group bg-neutral-900/40 hover:bg-neutral-900/80 border border-neutral-800/80 p-4 rounded-xl cursor-pointer transition-all flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                              <Terminal className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-white">Optimize Chaotic Thoughts</h5>
                              <p className="text-neutral-500 text-[10px]">Draft chaos and copy Todoist tasks</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-amber-400 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: ADHD PROMPTS HUB */}
                {activeTab === 'prompts' && (
                  <div className="space-y-6">
                    <div className="border-b border-amber-500/10 pb-4 mb-4">
                      <h2 className="text-2xl font-display font-black text-gold-gradient tracking-tight">ADHD Prompt Library</h2>
                      <p className="text-neutral-400 text-xs mt-1">Premium prompts fine-tuned for high cognitive friction, executive dysfunction, and focus lapses.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {premiumPrompts.map(prompt => (
                        <div key={prompt.id} className="bg-black/60 border border-amber-500/15 rounded-2xl p-6 relative overflow-hidden group">
                          {/* Top ambient color strip */}
                          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                          
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-neutral-900 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                {prompt.icon}
                              </div>
                              <div className="text-left">
                                <h4 className="text-base font-display font-bold text-white group-hover:text-amber-400 transition-colors">{prompt.title}</h4>
                                <p className="text-neutral-500 text-[11px]">{prompt.tagline}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <button 
                                onClick={() => copyToClipboard(prompt.promptText)}
                                className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-amber-500/30 rounded-lg text-[11px] font-mono hover:text-white transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copyFeedback ? 'Copied!' : 'Copy'}</span>
                              </button>
                              <button 
                                onClick={() => copyToClipboard(prompt.promptText)}
                                className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 hover:border-amber-500 text-amber-300 rounded-lg text-[11px] font-display font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                <FolderPlus className="w-3 h-3" />
                                <span>Export Plan</span>
                              </button>
                            </div>
                          </div>

                          <div className="bg-neutral-950/80 rounded-xl p-4 border border-neutral-900 font-mono text-[11px] text-neutral-400 overflow-x-auto max-h-[160px] leading-relaxed whitespace-pre-wrap text-left">
                            {prompt.promptText}
                          </div>

                          <div className="mt-3.5 flex items-center gap-2 text-[10px] text-neutral-500 bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-900/60">
                            <AlertCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span><strong>Best Practice:</strong> {prompt.explanation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 4: MIND DECLUTTERER AI ASSISTANT */}
                {activeTab === 'hermes' && (
                  <div className="space-y-6 flex-1 flex flex-col">
                    <div className="border-b border-amber-500/10 pb-4 mb-2">
                      <h2 className="text-2xl font-display font-black text-gold-gradient tracking-tight">Mind Declutterer AI</h2>
                      <p className="text-neutral-400 text-xs mt-1">Dump your messy thoughts, loop tasks, and worries. Our model will instantly extract, simplify, and build an ADHD momentum plan.</p>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Input */}
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Unstructured Brain Dump</label>
                          <span className="text-[10px] text-neutral-500">Shame-Free Entry</span>
                        </div>

                        <textarea
                          placeholder="Type anything here... e.g., 'I have to clean my kitchen but my arm feels heavy and I also need to prepare my slides for the team sync at 3pm but I can't find my notes and the room is messy and I should call back my sister too...'"
                          value={unstructuredThoughts}
                          onChange={(e) => setUnstructuredThoughts(e.target.value)}
                          className="flex-1 w-full bg-black/60 border border-amber-500/15 focus:border-amber-500/70 rounded-2xl p-4 text-sm text-neutral-200 placeholder-neutral-700 outline-none resize-none min-h-[220px] transition-all focus:ring-2 focus:ring-amber-500/10 leading-relaxed"
                        />

                        <button
                          onClick={handleOptimizeThoughts}
                          disabled={isOptimizing || !unstructuredThoughts.trim()}
                          className="w-full bg-gold-gradient text-neutral-950 font-display font-bold py-3.5 px-6 rounded-xl shadow-[0_4px_15px_rgba(212,175,55,0.2)] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none text-sm"
                        >
                          <Brain className="w-4 h-4" />
                          <span>{isOptimizing ? 'Recalculating Executive Plan...' : 'Declutter & Generate ADHD Plan'}</span>
                        </button>
                      </div>

                      {/* Right: Output */}
                      <div className="border border-neutral-900 rounded-2xl p-5 bg-neutral-900/20 flex flex-col justify-between min-h-[300px]">
                        {isOptimizing ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <RefreshCw className="w-10 h-10 text-amber-400 animate-spin mb-4" />
                            <h4 className="font-display font-bold text-white text-sm mb-1">Applying Cognitive De-escalation</h4>
                            <p className="text-neutral-500 text-[11px] max-w-xs leading-normal">Stripping complexity, isolating physical friction points, and converting panic to dopamine loops...</p>
                          </div>
                        ) : optimizedPlan ? (
                          <div className="space-y-5 flex-1 flex flex-col justify-between text-left">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">Analysis Optimal</span>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={handleExportPlanToWorkspace}
                                    disabled={isExportingPlan}
                                    className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
                                    title="Save Plan directly to Workspace"
                                  >
                                    <FolderPlus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Highlight Area */}
                              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                                <span className="text-[9px] font-mono uppercase tracking-wider text-amber-500 font-bold block mb-1">The One Big Thing</span>
                                <h4 className="text-xs font-bold text-white font-display leading-tight">{optimizedPlan.oneBigThing}</h4>
                              </div>

                              {/* Momentum Sparks */}
                              <div>
                                <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-400 font-bold block mb-1.5">Momentum Sparks (Under 3 mins)</span>
                                <ul className="space-y-1 text-xs">
                                  {optimizedPlan.momentumTasks.map((t, i) => (
                                    <li key={i} className="flex items-center gap-2 text-neutral-300">
                                      <CheckSquare className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                                      <span>{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Micro steps */}
                              <div>
                                <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400 font-bold block mb-1.5">Dopamine Micro-Plan</span>
                                <ul className="space-y-1.5 text-xs">
                                  {optimizedPlan.microPlan.map((t, i) => (
                                    <li key={i} className="flex items-start gap-2 text-neutral-300 leading-normal">
                                      <span className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                                      <span>{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="border-t border-neutral-900 pt-4 mt-4 flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={handleExportPlanToWorkspace}
                                disabled={isExportingPlan}
                                className="flex-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/30 text-white font-display font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                              >
                                <FolderPlus className="w-3.5 h-3.5" />
                                <span>{isExportingPlan ? 'Saving...' : 'Export Plan'}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setUnstructuredThoughts('');
                                  setOptimizedPlan(null);
                                }}
                                className="px-3 py-2.5 text-neutral-500 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer text-center"
                              >
                                Reset Form
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                            <Terminal className="w-8 h-8 text-neutral-700 mb-3" />
                            <h5 className="text-xs font-bold text-neutral-400 mb-1">Your Optimized Flow Will Appear Here</h5>
                            <p className="text-[11px] leading-relaxed max-w-xs text-neutral-600">
                              Write or paste your circular thoughts on the left and click the button. We will deconstruct it instantly.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: SYSTEM STACK CHECKLIST */}
                {activeTab === 'system' && (
                  <div className="space-y-6">
                    <div className="border-b border-amber-500/10 pb-4 mb-4">
                      <h2 className="text-2xl font-display font-black text-gold-gradient tracking-tight">System Build Checklist</h2>
                      <p className="text-neutral-400 text-xs mt-1">Checkoff steps sequentially to build your robust external brain infrastructure.</p>
                    </div>

                    <div className="space-y-4">
                      {/* Step 1 */}
                      <div className={`p-5 rounded-2xl border transition-all ${
                        completedSteps.includes('step1') 
                          ? 'bg-emerald-950/5 border-emerald-500/20' 
                          : 'bg-black/40 border-amber-500/10 hover:border-amber-500/20'
                      }`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <button 
                              onClick={() => toggleChecklistStep('step1')}
                              className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-all ${
                                completedSteps.includes('step1') 
                                  ? 'bg-emerald-500 border-emerald-500 text-neutral-950' 
                                  : 'border-neutral-700 hover:border-amber-500 bg-black'
                              }`}
                            >
                              {completedSteps.includes('step1') && <CheckSquare className="w-4.5 h-4.5 font-bold" />}
                            </button>
                            <div className="text-left">
                              <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest block mb-0.5">Scaffolding Module 01</span>
                              <h4 className="text-sm font-bold text-white font-display mb-1">Set Up Todoist Labels and Priorities</h4>
                              <p className="text-neutral-400 text-xs leading-normal">
                                Create an inbox project inside Todoist. Configure exactly 3 core tags: <code className="text-cyan-400 px-1 py-0.5 bg-neutral-900 rounded">@ADHD_Momentum</code> (low physical drag), <code className="text-amber-400 px-1 py-0.5 bg-neutral-900 rounded">@ADHD_Focus</code> (requires isolation), and <code className="text-emerald-400 px-1 py-0.5 bg-neutral-900 rounded">@Space_Setup</code> (environment resets).
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className={`p-5 rounded-2xl border transition-all ${
                        completedSteps.includes('step2') 
                          ? 'bg-emerald-950/5 border-emerald-500/20' 
                          : 'bg-black/40 border-amber-500/10 hover:border-amber-500/20'
                      }`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <button 
                              onClick={() => toggleChecklistStep('step2')}
                              className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-all ${
                                completedSteps.includes('step2') 
                                  ? 'bg-emerald-500 border-emerald-500 text-neutral-950' 
                                  : 'border-neutral-700 hover:border-amber-500 bg-black'
                              }`}
                            >
                              {completedSteps.includes('step2') && <CheckSquare className="w-4.5 h-4.5 font-bold" />}
                            </button>
                            <div className="text-left">
                              <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest block mb-0.5">Scaffolding Module 02</span>
                              <h4 className="text-sm font-bold text-white font-display mb-1">Sync Workspace ADHD Workspace</h4>
                              <p className="text-neutral-400 text-xs leading-normal">
                                Ensure your workspace is linked correctly. Navigate to the "Workspace" tab on the left sidebar and click "Workspace" to establish your designated, safe cloud system container.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className={`p-5 rounded-2xl border transition-all ${
                        completedSteps.includes('step3') 
                          ? 'bg-emerald-950/5 border-emerald-500/20' 
                          : 'bg-black/40 border-amber-500/10 hover:border-amber-500/20'
                      }`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <button 
                              onClick={() => toggleChecklistStep('step3')}
                              className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-all ${
                                completedSteps.includes('step3') 
                                  ? 'bg-emerald-500 border-emerald-500 text-neutral-950' 
                                  : 'border-neutral-700 hover:border-amber-500 bg-black'
                              }`}
                            >
                              {completedSteps.includes('step3') && <CheckSquare className="w-4.5 h-4.5 font-bold" />}
                            </button>
                            <div className="text-left">
                              <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest block mb-0.5">Scaffolding Module 03</span>
                              <h4 className="text-sm font-bold text-white font-display mb-1">Establish the Hermes Agent Connection</h4>
                              <p className="text-neutral-400 text-xs leading-normal">
                                Use the Mind Declutterer AI assistant to format physical friction thoughts, and export at least one optimized workflow guide to your workspace. Test opening and reading it from your local mobile device to ensure quick offline access.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer info */}
      <footer className="border-t border-amber-500/10 bg-black/90 py-6 px-6 mt-12 text-center text-xs text-neutral-500 font-mono relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} AI for ADHD. Luxurious exclusive space.</span>
          <div className="flex gap-6">
            <span className="text-amber-500/70 hover:text-amber-400 transition-colors cursor-pointer" onClick={onBack}>Return to Landing</span>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" className="hover:text-neutral-300">Facebook Group</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
