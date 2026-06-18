import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export type PublicBull = {
  id: string;
  name: string;
  breed: string;
  code: string;
  photo: string | null;
  quantity: number;
  quantitySexado: number;
};

export type PublicCatalog = {
  farmName: string;
  whatsapp: string;
  bulls: PublicBull[];
};

export const getPublicCatalog = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicCatalog | null> => {
    // Calls a SECURITY DEFINER RPC that exposes only the safe public columns.
    // No service-role key needed — works for anonymous visitors.
    const { data: rows, error } = await supabase.rpc("get_public_catalog", {
      _user_id: data.userId,
    });
    if (error) throw error;
    if (!rows || rows.length === 0) return null;

    const first = rows[0];
    const whatsapp = (first.whatsapp_number ?? "").replace(/\D/g, "");
    if (!whatsapp) return null;

    const bulls: PublicBull[] = rows
      .filter((r) => r.bull_id != null)
      .map((r) => ({
        id: r.bull_id as string,
        name: r.bull_name as string,
        breed: r.bull_breed as string,
        code: r.bull_code as string,
        photo: (r.bull_photo as string | null) ?? null,
        quantity: (r.bull_quantity as number | null) ?? 0,
        quantitySexado: (r.bull_quantity_sexado as number | null) ?? 0,
      }))
      .sort((a, b) => a.breed.localeCompare(b.breed) || a.name.localeCompare(b.name));

    return {
      farmName: (first.farm_name ?? "").trim() || "Catálogo de Touros",
      whatsapp,
      bulls,
    };
  });