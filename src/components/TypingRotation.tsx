import React, { useState, useEffect } from 'react';

export default function TypingRotation() {
  const phrases = [
    "Build AI task assistants for ADHD brains.",
    "Build AI brain dump organizers for ADHD brains.",
    "Build AI daily reset guides for ADHD brains.",
    "Build AI focus systems for ADHD brains.",
    "Build AI planning partners for ADHD brains."
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(70);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fullText = phrases[currentIdx];

    const handleType = () => {
      if (!isDeleting) {
        // Typing characters
        setDisplayedText(fullText.substring(0, displayedText.length + 1));
        setTypingSpeed(60);

        if (displayedText === fullText) {
          // Pause before starting backspace
          timer = setTimeout(() => setIsDeleting(true), 2500);
          return;
        }
      } else {
        // Deleting characters
        setDisplayedText(fullText.substring(0, displayedText.length - 1));
        setTypingSpeed(30);

        if (displayedText === '') {
          setIsDeleting(false);
          setCurrentIdx((prev) => (prev + 1) % phrases.length);
          return;
        }
      }

      timer = setTimeout(handleType, typingSpeed);
    };

    timer = setTimeout(handleType, typingSpeed);
    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, currentIdx]);

  return (
    <div className="min-h-[2rem] flex items-center justify-center font-mono text-xs sm:text-sm text-amber-300 font-semibold uppercase tracking-wider select-none">
      <span className="bg-amber-500/5 px-4 py-1.5 rounded-full border border-amber-500/10 shadow-[0_0_12px_rgba(212,175,55,0.06)]">
        ✨ <span className="typing-cursor">{displayedText}</span>
      </span>
    </div>
  );
}
