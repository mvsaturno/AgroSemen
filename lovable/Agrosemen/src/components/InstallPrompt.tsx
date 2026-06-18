import { useEffect, useState } from "react";
import { Download, Share, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "agrosemen-install-dismissed-at";
const DISMISS_DAYS = 7;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !/MSStream/i.test(ua);
}

function recentlyDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const diff = Date.now() - Number(v);
    return diff < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (recentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari doesn't fire beforeinstallprompt — show manual instructions
    if (isIOS()) {
      const t = setTimeout(() => {
        setShowIOS(true);
        setVisible(true);
      }, 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBIP);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <img
            src="/icons/icon-192.png"
            alt="Agrosêmen"
            className="h-12 w-12 flex-shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Instale o Agrosêmen</p>
            {showIOS ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Toque em <Share className="inline h-3.5 w-3.5 align-text-bottom" /> e depois em{" "}
                <span className="inline-flex items-center gap-0.5 font-medium">
                  <Plus className="h-3.5 w-3.5" /> Adicionar à Tela de Início
                </span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Acesso rápido pela tela inicial, sem abrir o navegador.
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!showIOS && (
          <div className="mt-3 flex gap-2">
            <Button onClick={install} className="flex-1" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Instalar
            </Button>
            <Button onClick={dismiss} variant="ghost" size="sm">
              Agora não
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}