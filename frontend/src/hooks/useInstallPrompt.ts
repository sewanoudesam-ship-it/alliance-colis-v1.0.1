import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

const DISMISS_KEY = "ac_install_dismissed_at";
const DISMISS_COOLDOWN_DAYS = 14;

export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  function wasRecentlyDismissed(): boolean {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const elapsedDays = (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24);
    return elapsedDays < DISMISS_COOLDOWN_DAYS;
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferredPrompt(null);
  }

  async function promptInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  const canPromptAndroid = !installed && !!deferredPrompt && !wasRecentlyDismissed();
  const shouldShowIosHint = !installed && isIos() && !wasRecentlyDismissed();

  return {
    installed,
    canPromptAndroid,
    shouldShowIosHint,
    promptInstall,
    dismiss,
  };
}
