import { useEffect, useState } from "react";
import { useQueryClient, useIsMutating, onlineManager } from "@tanstack/react-query";
import { WifiOff, RefreshCw } from "lucide-react";

export function OfflineIndicator() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const mutating = useIsMutating();

  useEffect(() => {
    const unsub = onlineManager.subscribe((isOnline) => {
      setOnline(isOnline);
      if (isOnline) {
        // Refresh data and resume queued mutations.
        qc.resumePausedMutations().then(() => qc.invalidateQueries());
      }
    });
    return unsub;
  }, [qc]);

  if (online && mutating === 0) return null;

  const syncing = online && mutating > 0;
  const pending = mutating;
  return (
    <div
      title={
        syncing
          ? "Sincronizando alterações pendentes"
          : "Sem conexão — alterações serão sincronizadas quando voltar online"
      }
      className={`fixed left-1/2 top-1 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm ${
        syncing
          ? "bg-primary/85 text-primary-foreground"
          : "bg-amber-500/85 text-white"
      }`}
    >
      {syncing ? (
        <>
          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          Sincronizando{pending > 0 ? ` (${pending})` : ""}
        </>
      ) : (
        <>
          <WifiOff className="h-2.5 w-2.5" />
          Offline{pending > 0 ? ` · ${pending} pendente${pending > 1 ? "s" : ""}` : ""}
        </>
      )}
    </div>
  );
}