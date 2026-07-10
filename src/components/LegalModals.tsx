import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Scale, Mail, FileText } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | null;
}

export default function LegalModals({ isOpen, onClose, type }: LegalModalProps) {
  if (!isOpen || !type) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="bg-neutral-950 border border-amber-500/30 p-6 sm:p-8 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto relative shadow-[0_0_50px_rgba(212,175,55,0.15)] text-left"
        >
          {/* Top Rainbow Accent Line */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-cyan-400 via-purple-500 via-pink-500 via-orange-400 via-yellow-300 to-green-500 rounded-t-2xl" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          {type === 'privacy' ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-neutral-900">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
                    Privacy Policy
                  </h2>
                  <p className="text-xs text-amber-500 font-mono tracking-wider uppercase mt-0.5">
                    AI for ADHD • Last Updated: July 2026
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="text-gray-300 text-xs sm:text-sm leading-relaxed space-y-4 font-sans font-light">
                <p>
                  At <strong>AI for ADHD</strong> (accessible via <strong>aiforadhd.xyz</strong>), we respect your privacy and are committed to protecting it. This Privacy Policy outlines how we collect, use, and safeguard your information when you join our waitlist, access our newsletter, or use our digital portal.
                </p>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  1. Information We Collect
                </h3>
                <p>
                  To provide our neurodivergent-friendly services, we collect minimal but necessary information:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
                  <li><strong>Waitlist & Newsletter Details:</strong> When you subscribe, we collect your email address so we can send prompts, workflows, and program updates.</li>
                  <li><strong>Account Credentials:</strong> If you use our Member's Portal, we use Firebase Authentication to secure your email address and passwordless login states.</li>
                  <li><strong>Productivity Tool Integrations:</strong> To configure custom assistants, the portal may access third-party API configurations (such as Todoist tokens) locally and securely on your device, which are never stored on our central database servers without your explicit permission.</li>
                </ul>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  2. How We Use Your Information
                </h3>
                <p>
                  We utilize your data strictly to support your executive function journey:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
                  <li>To distribute highly practical, shame-free AI prompts, templates, and tutorial videos.</li>
                  <li>To manage waitlist placement and deliver notifications for our launch and community programs.</li>
                  <li>To operate and secure the interactive Member's Portal and VIP session workspaces.</li>
                  <li>To respond to customer support inquiries and process feedback.</li>
                </ul>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  3. Cookies and Local Storage
                </h3>
                <p>
                  We use cookies and local browser storage (such as localStorage) solely to remember your portal login session, avoid making you sign in repeatedly, and maintain your preferences across page transitions. You can manage or clear these local sessions through your browser settings at any time.
                </p>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  4. Third-Party Integrations
                </h3>
                <p>
                  Our system coordinates with services like Firebase, Todoist, and Google APIs to run automation assistants. These services have their own independent privacy policies, and we recommend reviewing them. We never sell, lease, or rent your email address or account data to third-party marketers.
                </p>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  5. Your Rights and Control
                </h3>
                <p>
                  You are the ultimate author of your systems. At any point, you can:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
                  <li>Unsubscribe from our newsletter using the single-click link in any email footer.</li>
                  <li>Request complete deletion of your waitlist details or member account records.</li>
                  <li>Contact us to update or modify your saved preferences.</li>
                </ul>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  6. Contact Information
                </h3>
                <p>
                  If you have any questions, security concerns, or request data deletion, please reach out to our dedicated support hub.
                </p>
                <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl flex items-center gap-3 text-amber-400 text-xs sm:text-sm font-mono mt-2">
                  <Mail className="w-4.5 h-4.5 shrink-0" />
                  <span>Support Email: <strong className="text-white underline">SUPPORT@AIFORADHD.XYZ</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-neutral-900">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
                    Terms of Service
                  </h2>
                  <p className="text-xs text-amber-500 font-mono tracking-wider uppercase mt-0.5">
                    AI for ADHD • Last Updated: July 2026
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="text-gray-300 text-xs sm:text-sm leading-relaxed space-y-4 font-sans font-light">
                <p>
                  Welcome to <strong>AI for ADHD</strong> (referred to as "we", "us", or "our"). By accessing our website (<strong>aiforadhd.xyz</strong>), subscribing to our waitlist, or logging into our Member's Portal, you agree to comply with and be bound by the following Terms of Service. Please read them carefully.
                </p>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  1. Cognitive Support & No Medical Claims
                </h3>
                <p className="border-l-2 border-amber-500/40 pl-4 py-1 text-amber-100 bg-amber-500/5 rounded-r-xl italic">
                  AI for ADHD is a training hub, system stack, and learning series. All content, prompts, guides, and workflows are provided solely as supportive cognitive scaffolding to assist your executive function.
                </p>
                <p>
                  <strong>We do not make medical, clinical, or diagnostic claims.</strong> The materials and AI prompts published here are not a substitute for professional medical advice, diagnosis, therapy, or ADHD treatment. Always consult with a qualified healthcare provider regarding medical conditions or treatment plans.
                </p>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  2. User Account Security
                </h3>
                <p>
                  When creating an account in our portal, you agree to:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
                  <li>Provide accurate, current email addresses.</li>
                  <li>Maintain the confidentiality of your credentials and restrict unauthorized access to your local capsule session.</li>
                  <li>Promptly notify support of any potential security breaches.</li>
                </ul>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  3. Permitted & Acceptable Use
                </h3>
                <p>
                  You are fully encouraged to copy, modify, and customize our templates, Todoist configurations, and AI prompts for your own personal daily productivity and executive support systems.
                </p>
                <p>
                  However, you are strictly prohibited from reproducing, reselling, or commercializing our proprietary system workbooks, codebases, or educational materials as stand-alone assets without prior written consent from AI for ADHD.
                </p>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  4. Disclaimers and Limitation of Liability
                </h3>
                <p>
                  We build our systems to be robust, secure, and intuitive. However, all tools, software integrations, and prompts are provided <strong>"as is"</strong> and <strong>"as available"</strong> without warranty of any kind. 
                </p>
                <p>
                  We shall not be liable for any direct, indirect, incidental, or consequential losses, data corruptions, or system dysfunctions arising from your configuration of third-party automation tools (such as Todoist, Hermes Agent, or self-hosted Contabo VPS servers).
                </p>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  5. Term Modifications
                </h3>
                <p>
                  We reserve the right to revise or update these Terms of Service at any time. We will indicate the date of the latest update at the top of this document. Continued use of our systems after any modifications constitutes acceptance of the new terms.
                </p>

                <h3 className="text-white font-display font-bold text-sm sm:text-base pt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  6. Support & Inquiries
                </h3>
                <p>
                  If you have questions about these Terms, need technical assistance, or wish to seek permission for educational reuse, please contact us:
                </p>
                <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl flex items-center gap-3 text-amber-400 text-xs sm:text-sm font-mono mt-2">
                  <Mail className="w-4.5 h-4.5 shrink-0" />
                  <span>Support Email: <strong className="text-white underline">SUPPORT@AIFORADHD.XYZ</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Close Action */}
          <div className="mt-8 pt-4 border-t border-neutral-900 flex justify-end">
            <button
              onClick={onClose}
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/30 text-white font-display font-bold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer"
            >
              Understand & Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
