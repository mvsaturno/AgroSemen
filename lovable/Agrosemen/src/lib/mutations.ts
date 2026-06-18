import { supabase } from "@/integrations/supabase/client";
import type { Bull, Client, SemenType, AppProfile } from "./data";

export const MK = {
  addBull: ["bulls", "add"] as const,
  updateBull: ["bulls", "update"] as const,
  deleteBull: ["bulls", "delete"] as const,
  adjustBullQuantity: ["bulls", "adjust"] as const,
  importBulls: ["bulls", "import"] as const,
  addInsemination: ["inseminations", "add"] as const,
  deleteInsemination: ["inseminations", "delete"] as const,
  updateInsemination: ["inseminations", "update"] as const,
  setMinStock: ["settings", "minStock"] as const,
  setProfile: ["settings", "profile"] as const,
  setDefaultPrices: ["settings", "defaultPrices"] as const,
  setWhatsApp: ["settings", "whatsapp"] as const,
  addClient: ["clients", "add"] as const,
  updateClient: ["clients", "update"] as const,
  deleteClient: ["clients", "delete"] as const,
  restoreBackup: ["backup", "restore"] as const,
};

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

function bullToRow(b: Omit<Bull, "id">) {
  // Primary code/location kept for legacy lists/search (use Convencional as canonical)
  const primaryCode = (b.codeConvencional || b.codeSexadoMacho || b.codeSexadoFemea || "").trim();
  const primaryLocation = (b.canisterConvencional || b.canisterSexadoMacho || b.canisterSexadoFemea || "").trim();
  return {
    name: b.name, breed: b.breed,
    code: primaryCode, location: primaryLocation,
    supplier: b.supplier,
    photo: b.photo ?? null,
    quantity: b.quantity,
    quantity_sexado: 0, // legacy column unused (split into macho/femea)
    price_convencional: b.priceConvencional,
    price_sexado: b.priceSexadoMacho || b.priceSexadoFemea || 0,
    quantity_sexado_macho: b.quantitySexadoMacho,
    quantity_sexado_femea: b.quantitySexadoFemea,
    price_sexado_macho: b.priceSexadoMacho,
    price_sexado_femea: b.priceSexadoFemea,
    code_convencional: b.codeConvencional,
    code_sexado_macho: b.codeSexadoMacho,
    code_sexado_femea: b.codeSexadoFemea,
    canister_convencional: b.canisterConvencional,
    canister_sexado_macho: b.canisterSexadoMacho,
    canister_sexado_femea: b.canisterSexadoFemea,
    botijao_convencional: b.botijaoConvencional,
    botijao_sexado_macho: b.botijaoSexadoMacho,
    botijao_sexado_femea: b.botijaoSexadoFemea,
  };
}

export async function addBullFn(b: Omit<Bull, "id">): Promise<string> {
  const u = await currentUserOrThrow();
  const name = await currentUserName(u.id);
  const { data, error } = await supabase
    .from("bulls")
    .insert({ user_id: u.id, ...bullToRow(b) })
    .select("id").single();
  if (error) throw error;
  const entries: Array<{ type: SemenType; qty: number }> = [
    { type: "convencional", qty: b.quantity },
    { type: "sexado_macho", qty: b.quantitySexadoMacho },
    { type: "sexado_femea", qty: b.quantitySexadoFemea },
  ];
  for (const e of entries) {
    if (e.qty > 0) {
      await supabase.from("stock_movements").insert({
        user_id: u.id, type: "entry", semen_type: e.type,
        bull_id: data.id, bull_name: b.name,
        quantity: e.qty, user_name: name,
      });
    }
  }
  return data.id as string;
}

export async function updateBullFn(b: Bull): Promise<void> {
  const { error } = await supabase
    .from("bulls")
    .update(bullToRow(b))
    .eq("id", b.id);
  if (error) throw error;
}

export async function deleteBullFn(id: string): Promise<void> {
  const { error } = await supabase.from("bulls").delete().eq("id", id);
  if (error) throw error;
}

export type AdjustBullArgs = {
  bull: Bull;
  newQuantity: number;
  type: "entry" | "exit" | "adjust";
  semenType?: SemenType;
};
export async function adjustBullQuantityFn(args: AdjustBullArgs): Promise<void> {
  const u = await currentUserOrThrow();
  const name = await currentUserName(u.id);
  const sType: SemenType = args.semenType ?? "convencional";
  const currentQty =
    sType === "sexado_macho" ? args.bull.quantitySexadoMacho
    : sType === "sexado_femea" ? args.bull.quantitySexadoFemea
    : args.bull.quantity;
  const delta = args.newQuantity - currentQty;
  const update =
    sType === "sexado_macho" ? { quantity_sexado_macho: args.newQuantity }
    : sType === "sexado_femea" ? { quantity_sexado_femea: args.newQuantity }
    : { quantity: args.newQuantity };
  const { error } = await supabase
    .from("bulls").update(update).eq("id", args.bull.id);
  if (error) throw error;
  await supabase.from("stock_movements").insert({
    user_id: u.id,
    type: args.type, semen_type: sType,
    bull_id: args.bull.id, bull_name: args.bull.name,
    quantity: args.type === "exit" ? Math.abs(delta) || 1 : delta,
    user_name: name,
  });
}

export type AddInseminationArgs = {
  bull: Bull; cowId: string; client: string; clientId: string | null;
  date: string; price: number; semenType: SemenType;
};
export async function addInseminationFn(args: AddInseminationArgs): Promise<void> {
  const u = await currentUserOrThrow();
  const name = await currentUserName(u.id);
  const currentQty =
    args.semenType === "sexado_macho" ? args.bull.quantitySexadoMacho
    : args.semenType === "sexado_femea" ? args.bull.quantitySexadoFemea
    : args.bull.quantity;
  const newQty = Math.max(0, currentQty - 1);
  const update =
    args.semenType === "sexado_macho" ? { quantity_sexado_macho: newQty }
    : args.semenType === "sexado_femea" ? { quantity_sexado_femea: newQty }
    : { quantity: newQty };
  const { error: e1 } = await supabase
    .from("bulls").update(update).eq("id", args.bull.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("inseminations").insert({
    user_id: u.id, date: args.date, bull_id: args.bull.id,
    bull_name: args.bull.name, cow_id: args.cowId,
    client: args.client, client_id: args.clientId,
    semen_type: args.semenType,
    price: args.price, user_name: name,
  });
  if (e2) throw e2;
  await supabase.from("stock_movements").insert({
    user_id: u.id, date: args.date, type: "exit", semen_type: args.semenType,
    bull_id: args.bull.id, bull_name: args.bull.name,
    quantity: 1, user_name: name,
  });
}

export async function setMinStockFn(n: number): Promise<void> {
  const u = await currentUserOrThrow();
  await supabase.from("user_settings").upsert({ user_id: u.id, min_stock: n });
}

export async function deleteInseminationFn(id: string): Promise<void> {
  const u = await currentUserOrThrow();
  const name = await currentUserName(u.id);
  const { data: ins, error: e0 } = await supabase
    .from("inseminations")
    .select("bull_id,bull_name,semen_type")
    .eq("id", id)
    .maybeSingle();
  if (e0) throw e0;
  const { error } = await supabase.from("inseminations").delete().eq("id", id);
  if (error) throw error;
  if (ins?.bull_id) {
    const { data: bull } = await supabase
      .from("bulls")
      .select("quantity,quantity_sexado_macho,quantity_sexado_femea")
      .eq("id", ins.bull_id)
      .maybeSingle();
    if (bull) {
      // Legacy records may have semen_type === "sexado" → treat as macho
      const t = ins.semen_type === "sexado" ? "sexado_macho" : (ins.semen_type ?? "convencional");
      const update =
        t === "sexado_macho" ? { quantity_sexado_macho: (bull.quantity_sexado_macho ?? 0) + 1 }
        : t === "sexado_femea" ? { quantity_sexado_femea: (bull.quantity_sexado_femea ?? 0) + 1 }
        : { quantity: (bull.quantity ?? 0) + 1 };
      await supabase.from("bulls").update(update).eq("id", ins.bull_id);
      await supabase.from("stock_movements").insert({
        user_id: u.id, type: "entry",
        semen_type: t,
        bull_id: ins.bull_id, bull_name: ins.bull_name,
        quantity: 1, user_name: name,
      });
    }
  }
}

export async function setProfileFn(profile: AppProfile): Promise<void> {
  const u = await currentUserOrThrow();
  await supabase.from("user_settings").upsert({ user_id: u.id, profile });
}

export type UpdateInseminationArgs = {
  id: string;
  bullId: string;
  bullName: string;
  cowId: string;
  client: string;
  clientId: string | null;
  date: string;
  price: number;
  semenType: SemenType;
};

export async function updateInseminationFn(args: UpdateInseminationArgs): Promise<void> {
  const u = await currentUserOrThrow();
  const name = await currentUserName(u.id);

  // Load current record
  const { data: prev, error: e0 } = await supabase
    .from("inseminations")
    .select("bull_id,bull_name,semen_type")
    .eq("id", args.id)
    .maybeSingle();
  if (e0) throw e0;
  if (!prev) throw new Error("Inseminação não encontrada");

  const prevType = (prev.semen_type === "sexado" ? "sexado_macho" : (prev.semen_type ?? "convencional")) as SemenType;
  const prevBullId = prev.bull_id as string | null;
  const stockChanged = prevBullId !== args.bullId || prevType !== args.semenType;

  if (stockChanged) {
    // Validate destination stock
    const { data: newBull, error: eNB } = await supabase
      .from("bulls")
      .select("quantity,quantity_sexado_macho,quantity_sexado_femea")
      .eq("id", args.bullId)
      .maybeSingle();
    if (eNB) throw eNB;
    if (!newBull) throw new Error("Touro destino não encontrado");
    const destQty =
      args.semenType === "sexado_macho" ? (newBull.quantity_sexado_macho ?? 0)
      : args.semenType === "sexado_femea" ? (newBull.quantity_sexado_femea ?? 0)
      : (newBull.quantity ?? 0);
    if (destQty <= 0) throw new Error("Sem saldo do tipo selecionado para esse touro");

    // Return 1 to old bull/type
    if (prevBullId) {
      const { data: oldBull } = await supabase
        .from("bulls")
        .select("quantity,quantity_sexado_macho,quantity_sexado_femea")
        .eq("id", prevBullId)
        .maybeSingle();
      if (oldBull) {
        const upd =
          prevType === "sexado_macho" ? { quantity_sexado_macho: (oldBull.quantity_sexado_macho ?? 0) + 1 }
          : prevType === "sexado_femea" ? { quantity_sexado_femea: (oldBull.quantity_sexado_femea ?? 0) + 1 }
          : { quantity: (oldBull.quantity ?? 0) + 1 };
        await supabase.from("bulls").update(upd).eq("id", prevBullId);
        await supabase.from("stock_movements").insert({
          user_id: u.id, type: "entry", semen_type: prevType,
          bull_id: prevBullId, bull_name: prev.bull_name,
          quantity: 1, user_name: name,
        });
      }
    }

    // Withdraw 1 from new bull/type
    const updNew =
      args.semenType === "sexado_macho" ? { quantity_sexado_macho: Math.max(0, (newBull.quantity_sexado_macho ?? 0) - 1) }
      : args.semenType === "sexado_femea" ? { quantity_sexado_femea: Math.max(0, (newBull.quantity_sexado_femea ?? 0) - 1) }
      : { quantity: Math.max(0, (newBull.quantity ?? 0) - 1) };
    await supabase.from("bulls").update(updNew).eq("id", args.bullId);
    await supabase.from("stock_movements").insert({
      user_id: u.id, type: "exit", semen_type: args.semenType,
      bull_id: args.bullId, bull_name: args.bullName,
      quantity: 1, user_name: name,
    });
  }

  const { error: eUpd } = await supabase
    .from("inseminations")
    .update({
      bull_id: args.bullId,
      bull_name: args.bullName,
      cow_id: args.cowId,
      client: args.client,
      client_id: args.clientId,
      date: args.date,
      price: args.price,
      semen_type: args.semenType,
    })
    .eq("id", args.id);
  if (eUpd) throw eUpd;
}

export async function setDefaultPricesFn(args: { convencional: number; sexado: number }): Promise<void> {
  const u = await currentUserOrThrow();
  await supabase.from("user_settings").upsert({
    user_id: u.id,
    default_price_convencional: args.convencional,
    default_price_sexado: args.sexado,
    default_price: args.convencional,
  });
}

export async function setWhatsAppFn(value: string): Promise<void> {
  const u = await currentUserOrThrow();
  await supabase.from("user_settings").upsert({
    user_id: u.id,
    whatsapp_number: value.replace(/\D/g, ""),
  });
}

export async function importBullsFn(rows: Omit<Bull, "id">[]): Promise<void> {
  const u = await currentUserOrThrow();
  const { error } = await supabase.from("bulls").insert(
    rows.map((b) => ({ user_id: u.id, ...bullToRow(b) })),
  );
  if (error) throw error;
}

export async function addClientFn(c: Omit<Client, "id">): Promise<string> {
  const u = await currentUserOrThrow();
  const { data, error } = await supabase.from("clients").insert({
    user_id: u.id, name: c.name, phone: c.phone, location: c.location,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateClientFn(c: Client): Promise<void> {
  const { error } = await supabase.from("clients").update({
    name: c.name, phone: c.phone, location: c.location,
  }).eq("id", c.id);
  if (error) throw error;
}

export async function deleteClientFn(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Restore Backup ---------- */
type BackupPayload = {
  bulls?: Array<Record<string, unknown>>;
  inseminations?: Array<Record<string, unknown>>;
  movements?: Array<Record<string, unknown>>;
  clients?: Array<Record<string, unknown>>;
  settings?: Array<Record<string, unknown>>;
};

function stripUserId<T extends Record<string, unknown>>(row: T, uid: string): T {
  return { ...row, user_id: uid };
}

export async function restoreBackupFn(payload: BackupPayload): Promise<{
  bulls: number; inseminations: number; movements: number; clients: number;
}> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Arquivo inválido");
  }
  const hasAny = ["bulls", "inseminations", "movements", "clients", "settings"]
    .some((k) => Array.isArray((payload as Record<string, unknown>)[k]));
  if (!hasAny) {
    throw new Error("Arquivo de backup não reconhecido");
  }

  const u = await currentUserOrThrow();
  const uid = u.id;

  // Apaga em ordem segura (filhos antes de pais)
  const delIns = await supabase.from("inseminations").delete().eq("user_id", uid);
  if (delIns.error) throw delIns.error;
  const delMov = await supabase.from("stock_movements").delete().eq("user_id", uid);
  if (delMov.error) throw delMov.error;
  const delBulls = await supabase.from("bulls").delete().eq("user_id", uid);
  if (delBulls.error) throw delBulls.error;
  const delClients = await supabase.from("clients").delete().eq("user_id", uid);
  if (delClients.error) throw delClients.error;

  // Re-insere preservando os IDs originais
  const clients = (payload.clients ?? []).map((r) => stripUserId(r, uid));
  if (clients.length) {
    const { error } = await supabase.from("clients").insert(clients as never);
    if (error) throw error;
  }

  const bulls = (payload.bulls ?? []).map((r) => stripUserId(r, uid));
  if (bulls.length) {
    const { error } = await supabase.from("bulls").insert(bulls as never);
    if (error) throw error;
  }

  const ins = (payload.inseminations ?? []).map((r) => stripUserId(r, uid));
  if (ins.length) {
    const { error } = await supabase.from("inseminations").insert(ins as never);
    if (error) throw error;
  }

  const movs = (payload.movements ?? []).map((r) => stripUserId(r, uid));
  if (movs.length) {
    const { error } = await supabase.from("stock_movements").insert(movs as never);
    if (error) throw error;
  }

  // Atualiza user_settings com o conteúdo do backup (se existir)
  const s = payload.settings?.[0];
  if (s && typeof s === "object") {
    const row = stripUserId(s, uid);
    const { error } = await supabase.from("user_settings").upsert(row as never);
    if (error) throw error;
  }

  return {
    bulls: bulls.length,
    inseminations: ins.length,
    movements: movs.length,
    clients: clients.length,
  };
}

export function registerMutationDefaults(qc: import("@tanstack/react-query").QueryClient) {
  qc.setMutationDefaults(MK.addBull, { mutationFn: addBullFn });
  qc.setMutationDefaults(MK.updateBull, { mutationFn: updateBullFn });
  qc.setMutationDefaults(MK.deleteBull, { mutationFn: deleteBullFn });
  qc.setMutationDefaults(MK.adjustBullQuantity, { mutationFn: adjustBullQuantityFn });
  qc.setMutationDefaults(MK.importBulls, { mutationFn: importBullsFn });
  qc.setMutationDefaults(MK.addInsemination, { mutationFn: addInseminationFn });
  qc.setMutationDefaults(MK.deleteInsemination, { mutationFn: deleteInseminationFn });
  qc.setMutationDefaults(MK.setMinStock, { mutationFn: setMinStockFn });
  qc.setMutationDefaults(MK.setProfile, { mutationFn: setProfileFn });
  qc.setMutationDefaults(MK.setDefaultPrices, { mutationFn: setDefaultPricesFn });
  qc.setMutationDefaults(MK.setWhatsApp, { mutationFn: setWhatsAppFn });
  qc.setMutationDefaults(MK.addClient, { mutationFn: addClientFn });
  qc.setMutationDefaults(MK.updateClient, { mutationFn: updateClientFn });
  qc.setMutationDefaults(MK.deleteClient, { mutationFn: deleteClientFn });
  qc.setMutationDefaults(MK.restoreBackup, { mutationFn: restoreBackupFn });
}