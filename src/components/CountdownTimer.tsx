import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock } from 'lucide-react';

export default function CountdownTimer() {
  // Launch date: July 13, 2026 at 09:00:00 AM local time (PDT, UTC-7)
  const targetDate = new Date('2026-07-13T09:00:00-07:00');
  
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOver: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isOver: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  if (timeLeft.isOver) {
    return (
      <div className="flex flex-col items-center text-center mt-6 p-4 rounded-xl border border-amber-500/10 bg-amber-500/5 max-w-sm mx-auto">
        <span className="flex h-2.5 w-2.5 relative mb-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <p className="text-amber-200 text-sm font-mono tracking-wide">
          THE C.L.A.R.I.T.Y. SERIES IS NOW LIVE!
        </p>
      </div>
    );
  }

  const timeUnits = [
    { label: 'days', value: timeLeft.days },
    { label: 'hours', value: timeLeft.hours },
    { label: 'minutes', value: timeLeft.minutes },
    { label: 'seconds', value: timeLeft.seconds },
  ];

  return (
    <div id="countdown-wrapper" className="flex flex-col items-center mt-8">
      <div className="flex items-center gap-2 mb-3.5">
        <Clock className="w-3.5 h-3.5 text-amber-500/70" />
        <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">
          Countdown to C.L.A.R.I.T.Y. Launch (July 13th)
        </span>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4 select-none">
        {timeUnits.map((unit, idx) => (
          <React.Fragment key={unit.label}>
            <div className="flex flex-col items-center">
              {/* Digit Box */}
              <div className="relative w-14 sm:w-16 h-14 sm:h-16 flex items-center justify-center bg-neutral-950 border border-neutral-900 rounded-xl overflow-hidden shadow-inner">
                {/* Visual split line */}
                <div className="absolute inset-x-0 top-1/2 h-[1px] bg-neutral-900/80 z-10" />
                
                <span className="font-mono text-xl sm:text-2xl font-bold text-amber-400 tracking-tight gold-glow-text">
                  {String(unit.value).padStart(2, '0')}
                </span>
              </div>
              {/* Label */}
              <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500 mt-1.5">
                {unit.label}
              </span>
            </div>
            {idx < timeUnits.length - 1 && (
              <span className="text-neutral-700 font-mono text-lg mb-4">:</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
