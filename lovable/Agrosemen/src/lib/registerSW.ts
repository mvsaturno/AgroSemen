// Service Worker registration with iframe / Lovable preview guard.
// Only registers on the published site so the SW never interferes
// with the in-editor preview iframe.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovableproject-dev.com") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (inIframe || isPreviewHost) {
    // Make sure no SW from a previous visit lingers in preview.
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    return;
  }

  const register = () => {
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.error("[sw] register failed", err));
  };

  // Se o documento já carregou (comum quando o hook roda depois do
  // evento `load`), registra imediatamente; caso contrário, espera o load.
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}