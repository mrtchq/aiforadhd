(() => {
  'use strict';
  const track = document.getElementById('horizontalScrollArea');
  if (!track || document.querySelector('.account-card-nav')) return;
  const cards = Array.from(track.querySelectorAll('.glass-panel'));
  const footer = track.parentElement.querySelector('footer');
  if (cards.length < 2 || !footer) return;

  const nav = document.createElement('nav');
  nav.className = 'account-card-nav';
  nav.setAttribute('aria-label', 'Account card navigation');
  nav.innerHTML = '<button type="button" data-account-prev aria-label="Previous card" aria-controls="horizontalScrollArea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><span class="account-card-nav__hint">BROWSE CARDS</span><button type="button" data-account-next aria-label="Next card" aria-controls="horizontalScrollArea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>';
  footer.appendChild(nav);
  const previous = nav.querySelector('[data-account-prev]');
  const next = nav.querySelector('[data-account-next]');
  let frame = 0;

  function update() {
    frame = 0;
    const max = track.scrollWidth - track.clientWidth;
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
  }
  function scheduleUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  function move(direction) {
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    const max = track.scrollWidth - track.clientWidth;
    track.scrollTo({
      left: Math.max(0, Math.min(max, track.scrollLeft + direction * step)),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  }
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleUpdate).observe(track);
  update();
})();
