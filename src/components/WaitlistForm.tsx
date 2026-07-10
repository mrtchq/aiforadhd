import { FormEvent, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Mail, ShieldCheck, Sparkles, User } from 'lucide-react';

const encode = (data: Record<string, string>) =>
  new URLSearchParams(data).toString();

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address so we can reach you.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({
          'form-name': 'waitlist',
          name: name.trim(),
          email: email.trim(),
          'bot-field': '',
        }),
      });

      if (!response.ok) {
        throw new Error(`Submission failed with status ${response.status}`);
      }

      setIsSubmitted(true);
    } catch (submissionError) {
      console.error(submissionError);
      setError('We could not save your spot just now. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
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
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl" aria-hidden="true">
              <motion.div
                initial={{ x: '-150%' }}
                animate={{ x: '150%' }}
                transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', repeatDelay: 1.5 }}
                className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-amber-500/15 to-transparent skew-x-12"
              />
            </div>

            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-amber-500/80 to-transparent" aria-hidden="true" />

            <div className="text-center mb-8 relative">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-3">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Join the Free Waitlist
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-black text-gold-gradient gold-glow-text tracking-tight">
                Join the Free Waitlist
              </h2>
              <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
                No subscription fee. No complex setup. Just practical support sent directly to your inbox.
              </p>
            </div>

            <form
              name="waitlist"
              method="POST"
              data-netlify="true"
              data-netlify-honeypot="bot-field"
              onSubmit={handleSubmit}
              className="space-y-4 relative"
            >
              <input type="hidden" name="form-name" value="waitlist" />
              <p className="hidden" aria-hidden="true">
                <label>Do not fill this out: <input name="bot-field" tabIndex={-1} autoComplete="off" /></label>
              </p>

              <div className="group">
                <label htmlFor="waitlist-name" className="block text-xs font-mono font-medium text-amber-400/80 uppercase tracking-wider mb-1.5 ml-1">
                  First name <span className="text-neutral-500 font-sans text-[10px] lowercase italic">(optional)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" aria-hidden="true" />
                  <input
                    id="waitlist-name"
                    name="name"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Your first name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full bg-black/80 border border-amber-500/20 focus:border-amber-500/70 rounded-xl py-3 pl-10 pr-4 text-white placeholder-neutral-600 outline-none text-base transition-all focus:ring-2 focus:ring-amber-500/15"
                  />
                </div>
              </div>

              <div className="group">
                <label htmlFor="waitlist-email" className="block text-xs font-mono font-medium text-amber-400/80 uppercase tracking-wider mb-1.5 ml-1">
                  Email address <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" aria-hidden="true" />
                  <input
                    id="waitlist-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full bg-black/80 border border-amber-500/20 focus:border-amber-500/70 rounded-xl py-3 pl-10 pr-4 text-white placeholder-neutral-600 outline-none text-base transition-all focus:ring-2 focus:ring-amber-500/15"
                  />
                </div>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="text-red-300 text-xs bg-red-950/30 border border-red-900/40 p-3 rounded-lg text-center">
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gold-gradient hover:brightness-110 active:scale-[0.98] text-neutral-950 font-display font-bold py-3.5 px-6 rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.25)] flex items-center justify-center gap-2 transition-all duration-300 mt-6 disabled:opacity-60 disabled:cursor-wait"
              >
                {isSubmitting ? 'Saving your spot…' : 'Join Waitlist'}
                {!isSubmitting && <ArrowRight className="w-5 h-5" aria-hidden="true" />}
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-amber-500/15 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Free to join. Unsubscribe anytime. No shame, no spam.</span>
            </div>

            <p className="text-neutral-500 text-[11px] leading-relaxed text-center mt-4 max-w-sm mx-auto">
              Get beginner-friendly AI prompts, Todoist workflows, Hermes Agent tutorials, and practical systems built for real life.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="success-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-black border-2 border-amber-500/50 p-8 sm:p-10 rounded-2xl text-center shadow-[0_0_40px_rgba(212,175,55,0.25)] relative overflow-hidden"
            role="status"
          >
            <CheckCircle2 className="w-14 h-14 text-amber-400 mx-auto mb-6" aria-hidden="true" />
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
              {name ? `You’re on the list, ${name}!` : 'You’re on the list!'}
            </h2>
            <p className="text-gray-400 text-sm mt-3 max-w-md mx-auto leading-relaxed">
              Your spot is saved. Watch your inbox for beginner-friendly prompts, workflows, and launch updates.
            </p>
            <p className="mt-6 text-sm text-amber-200">
              Your brain is not broken. The system just needs to be built differently.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
