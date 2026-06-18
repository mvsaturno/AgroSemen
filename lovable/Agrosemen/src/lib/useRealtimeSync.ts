import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./data";

const TABLE_KEYS: Record<string, string[]> = {
  bulls: ["bulls"],
  inseminations: ["inseminations"],
  clients: ["clients"],
  stock_movements: ["bulls"], // movements affect stock
  user_settings: ["settings"],
};

export function useRealtimeSync() {
  const { user } = useSession();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const filter = `user_id=eq.${user.id}`;
    const channel = supabase.channel(`rt-${user.id}`);

    for (const table of Object.keys(TABLE_KEYS)) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => {
          for (const key of TABLE_KEYS[table]) {
            qc.invalidateQueries({ queryKey: [key] });
          }
        },
      );
    }

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}