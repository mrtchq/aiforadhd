import React, { useMemo } from 'react';

export default function ParallaxStars() {
  const css = useMemo(() => {
    const generateBoxShadows = (count: number) => {
      const shadows = [];
      for (let i = 0; i < count; i++) {
        const x = Math.floor(Math.random() * 2000);
        const y = Math.floor(Math.random() * 2000);
        // Using semi-transparent white/gold hint for visual softness and neurodivergent premium vibes
        const opacity = (Math.random() * 0.4 + 0.6).toFixed(2);
        shadows.push(`${x}px ${y}px rgba(255, 255, 255, ${opacity})`);
      }
      return shadows.join(', ');
    };

    const shadowsSmall = generateBoxShadows(700);
    const shadowsMedium = generateBoxShadows(200);
    const shadowsBig = generateBoxShadows(100);

    return `
      @keyframes animParallaxStar {
        from {
          transform: translateY(0px);
        }
        to {
          transform: translateY(-2000px);
        }
      }

      #parallax-stars {
        width: 1px;
        height: 1px;
        background: transparent;
        box-shadow: ${shadowsSmall};
        animation: animParallaxStar 50s linear infinite;
        position: absolute;
        top: 0;
        left: 0;
      }
      #parallax-stars::after {
        content: " ";
        position: absolute;
        top: 2000px;
        left: 0;
        width: 1px;
        height: 1px;
        background: transparent;
        box-shadow: ${shadowsSmall};
      }

      #parallax-stars2 {
        width: 2px;
        height: 2px;
        background: transparent;
        box-shadow: ${shadowsMedium};
        animation: animParallaxStar 100s linear infinite;
        position: absolute;
        top: 0;
        left: 0;
      }
      #parallax-stars2::after {
        content: " ";
        position: absolute;
        top: 2000px;
        left: 0;
        width: 2px;
        height: 2px;
        background: transparent;
        box-shadow: ${shadowsMedium};
      }

      #parallax-stars3 {
        width: 3px;
        height: 3px;
        background: transparent;
        box-shadow: ${shadowsBig};
        animation: animParallaxStar 150s linear infinite;
        position: absolute;
        top: 0;
        left: 0;
      }
      #parallax-stars3::after {
        content: " ";
        position: absolute;
        top: 2000px;
        left: 0;
        width: 3px;
        height: 3px;
        background: transparent;
        box-shadow: ${shadowsBig};
      }
    `;
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        <div id="parallax-stars" />
        <div id="parallax-stars2" />
        <div id="parallax-stars3" />
      </div>
    </>
  );
}
