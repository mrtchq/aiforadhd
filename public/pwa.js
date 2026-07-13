// PWA Management and Service Worker Registration for AI for ADHD
console.log("[PWA] Initializing installation manager...");

// 1. Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js?v=5', { updateViaCache: 'none' })
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);
        return reg.update();
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  });
}

// 2. Install Prompt Handling & Visual Prompts
let deferredPrompt = null;

// Selectors / Storage keys
const DISMISS_KEY = 'ai-for-adhd-pwa-dismissed';

// Detect if app is already running in standalone (installed) mode
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone || 
         document.referrer.includes('android-app://');
}

// Detect iOS Safari
function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIPad = !!ua.match(/iPad/i);
  const isIPhone = !!ua.match(/iPhone/i);
  const isChromium = ua.indexOf('CriOS') > -1;
  const isSafari = ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1;
  return (isIPad || isIPhone) && isSafari && !isChromium;
}

// Show the PWA Installation Banner
function showPwaBanner(type) {
  // If user previously dismissed the PWA banner or is already running standalone, do not show
  if (localStorage.getItem(DISMISS_KEY) === 'true' || isStandalone()) {
    console.log('[PWA] Banner skipped: either dismissed or already installed.');
    return;
  }

  // Prevent multiple banners from being created
  if (document.getElementById('pwa-install-banner')) {
    console.log('[PWA] Banner already exists, skipping creation.');
    return;
  }

  // Create banner container
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  
  // Set styling via Tailwind classes and inline transitions
  banner.className = 'fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-md bg-neutral-950/95 border border-[#d8ad30]/30 rounded-2xl p-5 shadow-[0_8px_30px_rgba(216,173,48,0.2)] text-white z-50 transition-all duration-500 transform translate-y-10 opacity-0 backdrop-blur-md flex flex-col gap-4 font-sans';

  // S3 Logo Icon
  const logoUrl = 'https://subpagebucket.s3.eu-north-1.amazonaws.com/library/934/8efcf85b-cc3a-42b7-a2e5-168705e77dab.png';

  let innerHTML = `
    <div class="flex items-start gap-3.5">
      <img src="${logoUrl}" alt="AI for ADHD Icon" class="w-12 h-12 rounded-xl border border-[#d8ad30]/20 flex-shrink-0" />
      <div class="space-y-1 flex-1">
        <h4 class="text-sm font-semibold text-white tracking-tight">Install AI for ADHD App</h4>
        <p class="text-xs text-neutral-400 font-light leading-relaxed">
  `;

  if (type === 'ios') {
    innerHTML += `
          Add this app to your Home Screen for seamless offline-friendly access, zero browser distractions, and ADHD-friendly systems.
        </p>
      </div>
    </div>
    <div class="bg-neutral-900/50 border border-white/5 rounded-lg p-3 text-[11px] text-[#d8ad30] flex items-center gap-2 font-medium">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M12 2v9"></path><path d="m8 5 4-4 4 4"></path></svg>
      <span>Tap the <strong>Share</strong> button, then select <strong>'Add to Home Screen'</strong></span>
    </div>
    <div class="flex justify-end gap-2.5">
      <button id="pwa-dismiss-btn" class="px-4 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer font-medium">
        Maybe Later
      </button>
    </div>
    `;
  } else {
    innerHTML += `
          Install our companion app for fast launch, offline loading, and distraction-free learning.
        </p>
      </div>
    </div>
    <div class="flex justify-end gap-2.5 pt-1">
      <button id="pwa-dismiss-btn" class="px-4 py-2 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer font-medium">
        Maybe Later
      </button>
      <button id="pwa-install-btn" class="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 transform active:scale-95 cursor-pointer shadow-[0_4px_12px_rgba(216,173,48,0.25)] flex items-center gap-1.5">
        Install App
      </button>
    </div>
    `;
  }

  banner.innerHTML = innerHTML;
  document.body.appendChild(banner);

  // Trigger animation after append
  setTimeout(() => {
    banner.classList.remove('translate-y-10', 'opacity-0');
    banner.classList.add('translate-y-0', 'opacity-100');
  }, 100);

  // Bind actions relative to the newly created banner element
  const dismissBtn = banner.querySelector('#pwa-dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      localStorage.setItem(DISMISS_KEY, 'true');
      dismissBanner();
    });
  }

  const installBtn = banner.querySelector('#pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted the installation prompt.');
          } else {
            console.log('[PWA] User dismissed the installation prompt.');
          }
          deferredPrompt = null;
          dismissBanner();
        });
      }
    });
  }
}

// Fade out and remove banner
function dismissBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.classList.remove('translate-y-0', 'opacity-100');
    banner.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => {
      banner.remove();
    }, 500);
  }
}

// Listen for native beforeinstallprompt (Android / Desktop Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('[PWA] beforeinstallprompt event fired.');
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  
  // Show PWA install banner for Chrome/Android/Desktop
  showPwaBanner('standard');
});

// Safari iOS Specific Detection on Load
window.addEventListener('load', () => {
  // Wait a small bit so it doesn't immediately visual-clutter on load
  setTimeout(() => {
    if (isIosSafari()) {
      console.log('[PWA] iOS Safari detected.');
      showPwaBanner('ios');
    }
  }, 3000);
});

// Log custom app installed success event
window.addEventListener('appinstalled', (evt) => {
  console.log('[PWA] App installed successfully!');
  dismissBanner();
});
