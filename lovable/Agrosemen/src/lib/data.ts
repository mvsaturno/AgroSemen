import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import {
  MK,
  addBullFn,
  updateBullFn,
  deleteBullFn,
  adjustBullQuantityFn,
  addInseminationFn,
  deleteInseminationFn,
  updateInseminationFn,
  restoreBackupFn,
  setMinStockFn,
  setProfileFn,
  setDefaultPricesFn,
  importBullsFn,
  addClientFn,
  updateClientFn,
  deleteClientFn,
  setWhatsAppFn,
} from "./mutations";

/* ---------- types ---------- */
export type SemenType = "convencional" | "sexado_macho" | "sexado_femea";

export type Bull = {
  id: string;
  name: string;
  breed: string;
  supplier: string;
  photo?: string | null;

  /* per-type fields */
  quantity: number;           // convencional
  priceConvencional: number;
  codeConvencional: string;
  canisterConvencional: string;
  botijaoConvencional: string;

  quantitySexadoMacho: number;
  priceSexadoMacho: number;
  codeSexadoMacho: string;
  canisterSexadoMacho: string;
  botijaoSexadoMacho: string;

  quantitySexadoFemea: number;
  priceSexadoFemea: number;
  codeSexadoFemea: string;
  canisterSexadoFemea: string;
  botijaoSexadoFemea: string;

  /* derived / legacy (back-compat for lists, search, dashboard) */
  code: string;                 // first non-empty code
  location: string;             // first non-empty caneca
  quantitySexado: number;       // macho + femea
  priceSexado: number;          // macho (fallback femea)
};

export type Insemination = {
  id: string;
  date: string;
  bullId: string | null;
  bullName: string;
  cowId: string;
  client: string;
  clientId: string | null;
  semenType: SemenType;
  price: number;
  userName: string;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  location: string;
};

export type AppProfile = "comercial" | "proprio";
export type Settings = {
  minStock: number;
  displayName: string;
  profile: AppProfile | null;
  defaultPrice: number;
  defaultPriceConvencional: number;
  defaultPriceSexado: number;
  whatsappNumber: string;
};

/* ---------- auth helpers ---------- */
export function contactToEmail(contact: string): string {
  const c = contact.trim();
  if (c.includes("@")) return c.toLowerCase();
  const digits = c.replace(/\D/g, "");
  return `${digits}@phone.agro`;
}
export function pinToPassword(pin: string): string {
  return `agro_pin_${pin}`;
}

/* ---------- session ---------- */
export type AppUser = { id: string; name: string; contact: string } | null;

export function useSession(): { user: AppUser; loading: boolean } {
  const [state, setState] = useState<{ user: AppUser; loading: boolean }>({
    user: null,
    loading: true,
  });
  const qc = useQueryClient();

  useEffect(() => {
    let mounted = true;

    const hydrate = async (session: Session | null) => {
      if (!session?.user) {
        if (mounted) setState({ user: null, loading: false });
        return;
      }
      const u = session.user;
      // Hydrate IMMEDIATELY with a fallback name so the app opens offline
      // even when the network is down. Then refresh the real display name
      // in the background if the request succeeds.
      const fallback = (u.email ?? "Usuário").split("@")[0];
      if (mounted) {
        setState({
          user: { id: u.id, name: fallback, contact: u.email ?? "" },
          loading: false,
        });
      }
      void fetchDisplayName(u)
        .then((name) => {
          if (mounted && name && name !== fallback) {
            setState((s) =>
              s.user ? { user: { ...s.user, name }, loading: false } : s,
            );
          }
        })
        .catch(() => {
          /* offline — keep fallback */
        });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      void hydrate(session);
      qc.invalidateQueries();
    });
    supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  return state;
}

async function fetchDisplayName(user: User): Promise<string> {
  try {
    const { data } = await supabase
      .from("user_settings")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    return data?.display_name?.trim() || (user.email ?? "Usuário").split("@")[0];
  } catch {
    return (user.email ?? "Usuário").split("@")[0];
  }
}

export async function signUp(name: string, contact: string, pin: string) {
  const email = contactToEmail(contact);
  const password = pinToPassword(pin);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) throw error;
  if (data.user) {
    await supabase.from("user_settings").upsert({
      user_id: data.user.id,
      display_name: name.trim(),
      min_stock: 3,
    });
  }
}

export async function signIn(contact: string, pin: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: contactToEmail(contact),
    password: pinToPassword(pin),
  });
  if (error) throw error;
}

export async function signOutUser() {
  await supabase.auth.signOut();
}

/* ---------- mapping ---------- */
type BullRow = {
  id: string; name: string; breed: string; code: string;
  supplier: string; location: string; photo: string | null;
  quantity: number; quantity_sexado: number;
  price_convencional: number | string; price_sexado: number | string;
  quantity_sexado_macho?: number; quantity_sexado_femea?: number;
  price_sexado_macho?: number | string; price_sexado_femea?: number | string;
  code_convencional?: string; code_sexado_macho?: string; code_sexado_femea?: string;
  canister_convencional?: string; canister_sexado_macho?: string; canister_sexado_femea?: string;
  botijao_convencional?: string; botijao_sexado_macho?: string; botijao_sexado_femea?: string;
};
const firstNonEmpty = (...v: (string | undefined | null)[]) =>
  v.map((x) => (x ?? "").trim()).find((x) => x.length > 0) ?? "";
const mapBull = (r: BullRow): Bull => {
  const codeConv = r.code_convencional ?? "";
  const codeM = r.code_sexado_macho ?? "";
  const codeF = r.code_sexado_femea ?? "";
  const canConv = r.canister_convencional ?? "";
  const canM = r.canister_sexado_macho ?? "";
  const canF = r.canister_sexado_femea ?? "";
  const qSexM = r.quantity_sexado_macho ?? 0;
  const qSexF = r.quantity_sexado_femea ?? 0;
  const pSexM = Number(r.price_sexado_macho ?? 0);
  const pSexF = Number(r.price_sexado_femea ?? 0);
  return {
    id: r.id, name: r.name, breed: r.breed,
    supplier: r.supplier, photo: r.photo ?? undefined,

    quantity: r.quantity,
    priceConvencional: Number(r.price_convencional ?? 0),
    codeConvencional: codeConv || r.code || "",
    canisterConvencional: canConv || r.location || "",
    botijaoConvencional: r.botijao_convencional ?? "",

    quantitySexadoMacho: qSexM,
    priceSexadoMacho: pSexM,
    codeSexadoMacho: codeM,
    canisterSexadoMacho: canM,
    botijaoSexadoMacho: r.botijao_sexado_macho ?? "",

    quantitySexadoFemea: qSexF,
    priceSexadoFemea: pSexF,
    codeSexadoFemea: codeF,
    canisterSexadoFemea: canF,
    botijaoSexadoFemea: r.botijao_sexado_femea ?? "",

    // legacy / derived for lists/search/dashboards
    code: firstNonEmpty(codeConv, r.code, codeM, codeF),
    location: firstNonEmpty(canConv, r.location, canM, canF),
    quantitySexado: qSexM + qSexF,
    priceSexado: pSexM || pSexF,
  };
};

/* ---------- queries ---------- */
export function useBulls() {
  return useQuery({
    queryKey: ["bulls"],
    queryFn: async (): Promise<Bull[]> => {
      const { data, error } = await supabase
        .from("bulls")
        .select("id,name,breed,code,supplier,location,photo,quantity,quantity_sexado,price_convencional,price_sexado,quantity_sexado_macho,quantity_sexado_femea,price_sexado_macho,price_sexado_femea,code_convencional,code_sexado_macho,code_sexado_femea,canister_convencional,canister_sexado_macho,canister_sexado_femea,botijao_convencional,botijao_sexado_macho,botijao_sexado_femea")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r) => mapBull(r as unknown as BullRow));
    },
  });
}

export function useInseminations() {
  return useQuery({
    queryKey: ["inseminations"],
    queryFn: async (): Promise<Insemination[]> => {
      const { data, error } = await supabase
        .from("inseminations")
        .select("id,date,bull_id,bull_name,cow_id,client,client_id,semen_type,price,user_name")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => {
        const row = r as unknown as {
          id: string; date: string; bull_id: string | null; bull_name: string;
          cow_id: string; client: string; client_id: string | null;
          semen_type: string; price: number | string; user_name: string;
        };
        return {
          id: row.id, date: row.date,
          bullId: row.bull_id, bullName: row.bull_name,
          cowId: row.cow_id, client: row.client,
          clientId: row.client_id,
          semenType: (row.semen_type as SemenType) ?? "convencional",
          price: Number(row.price), userName: row.user_name,
        };
      });
    },
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,phone,location")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings> => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return { minStock: 3, displayName: "", profile: null, defaultPrice: 0, defaultPriceConvencional: 0, defaultPriceSexado: 0, whatsappNumber: "" };
      const { data } = await supabase
        .from("user_settings")
        .select("min_stock,display_name,profile,default_price,default_price_convencional,default_price_sexado,whatsapp_number")
        .eq("user_id", uid)
        .maybeSingle();
      const row = data as { min_stock?: number; display_name?: string; profile?: string | null; default_price?: number | string; default_price_convencional?: number | string; default_price_sexado?: number | string; whatsapp_number?: string } | null;
      const legacy = Number(row?.default_price ?? 0);
      return {
        minStock: row?.min_stock ?? 3,
        displayName: row?.display_name ?? "",
        profile: (row?.profile as AppProfile | null) ?? null,
        defaultPrice: legacy,
        defaultPriceConvencional: Number(row?.default_price_convencional ?? legacy ?? 0),
        defaultPriceSexado: Number(row?.default_price_sexado ?? 0),
        whatsappNumber: row?.whatsapp_number ?? "",
      };
    },
  });
}

/* ---------- mutations ---------- */
async function currentUserOrThrow() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Não autenticado");
  return data.user;
}
async function currentUserName(uid: string): Promise<string> {
  const { data } = await supabase
    .from("user_settings").select("display_name").eq("user_id", uid).maybeSingle();
  return data?.display_name ?? "";
}

export function useAddBull() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.addBull,
    mutationFn: addBullFn,
    onMutate: async (b) => {
      await qc.cancelQueries({ queryKey: ["bulls"] });
      const prev = qc.getQueryData<Bull[]>(["bulls"]);
      const optimistic: Bull = { id: `temp-${crypto.randomUUID()}`, ...b };
      qc.setQueryData<Bull[]>(["bulls"], [...(prev ?? []), optimistic]
        .sort((a, c) => a.name.localeCompare(c.name)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["bulls"], ctx.prev);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bulls"] }),
  });
}

export function useUpdateBull() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.updateBull,
    mutationFn: updateBullFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bulls"] }),
  });
}

export function useDeleteBull() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.deleteBull,
    mutationFn: deleteBullFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bulls"] }),
  });
}

export function useAdjustBullQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.adjustBullQuantity,
    mutationFn: adjustBullQuantityFn,
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["bulls"] });
      const prev = qc.getQueryData<Bull[]>(["bulls"]);
      qc.setQueryData<Bull[]>(["bulls"], (old) =>
        (old ?? []).map((b) => {
          if (b.id !== args.bull.id) return b;
          if (args.semenType === "sexado_macho") {
            const m = args.newQuantity;
            return { ...b, quantitySexadoMacho: m, quantitySexado: m + b.quantitySexadoFemea };
          }
          if (args.semenType === "sexado_femea") {
            const f = args.newQuantity;
            return { ...b, quantitySexadoFemea: f, quantitySexado: b.quantitySexadoMacho + f };
          }
          return { ...b, quantity: args.newQuantity };
        }),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["bulls"], ctx.prev);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bulls"] }),
  });
}

export function useAddInsemination() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.addInsemination,
    mutationFn: addInseminationFn,
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["bulls"] });
      await qc.cancelQueries({ queryKey: ["inseminations"] });
      const prevBulls = qc.getQueryData<Bull[]>(["bulls"]);
      const prevIns = qc.getQueryData<Insemination[]>(["inseminations"]);
      qc.setQueryData<Bull[]>(["bulls"], (old) =>
        (old ?? []).map((b) => {
          if (b.id !== args.bull.id) return b;
          if (args.semenType === "sexado_macho") {
            const m = Math.max(0, b.quantitySexadoMacho - 1);
            return { ...b, quantitySexadoMacho: m, quantitySexado: m + b.quantitySexadoFemea };
          }
          if (args.semenType === "sexado_femea") {
            const f = Math.max(0, b.quantitySexadoFemea - 1);
            return { ...b, quantitySexadoFemea: f, quantitySexado: b.quantitySexadoMacho + f };
          }
          return { ...b, quantity: Math.max(0, b.quantity - 1) };
        }),
      );
      const optimistic: Insemination = {
        id: `temp-${crypto.randomUUID()}`,
        date: args.date,
        bullId: args.bull.id,
        bullName: args.bull.name,
        cowId: args.cowId,
        client: args.client,
        clientId: args.clientId,
        semenType: args.semenType,
        price: args.price,
        userName: "",
      };
      qc.setQueryData<Insemination[]>(["inseminations"], [optimistic, ...(prevIns ?? [])]);
      return { prevBulls, prevIns };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevBulls) qc.setQueryData(["bulls"], ctx.prevBulls);
      if (ctx?.prevIns) qc.setQueryData(["inseminations"], ctx.prevIns);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bulls"] });
      qc.invalidateQueries({ queryKey: ["inseminations"] });
    },
  });
}

export function useDeleteInsemination() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.deleteInsemination,
    mutationFn: deleteInseminationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bulls"] });
      qc.invalidateQueries({ queryKey: ["inseminations"] });
    },
  });
}

export function useUpdateInsemination() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.updateInsemination,
    mutationFn: updateInseminationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bulls"] });
      qc.invalidateQueries({ queryKey: ["inseminations"] });
    },
  });
}

export function useSetMinStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.setMinStock,
    mutationFn: setMinStockFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useSetProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.setProfile,
    mutationFn: setProfileFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useSetDefaultPrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.setDefaultPrices,
    mutationFn: setDefaultPricesFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useSetWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.setWhatsApp,
    mutationFn: setWhatsAppFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useImportBulls() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.importBulls,
    mutationFn: importBullsFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bulls"] }),
  });
}

/* ---------- clients mutations ---------- */
export function useAddClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.addClient,
    mutationFn: addClientFn,
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: ["clients"] });
      const prev = qc.getQueryData<Client[]>(["clients"]);
      const optimistic: Client = { id: `temp-${crypto.randomUUID()}`, ...c };
      qc.setQueryData<Client[]>(["clients"], [...(prev ?? []), optimistic]
        .sort((a, b) => a.name.localeCompare(b.name)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["clients"], ctx.prev);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.updateClient,
    mutationFn: updateClientFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.deleteClient,
    mutationFn: deleteClientFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: MK.restoreBackup,
    mutationFn: restoreBackupFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bulls"] });
      qc.invalidateQueries({ queryKey: ["inseminations"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
