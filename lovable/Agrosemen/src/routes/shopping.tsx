import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useBulls, useSettings, useSession } from "@/lib/data";
import { Download, Minus, Plus, Trash2, Save, Share2, Plus as PlusIcon, Search } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/shopping")({ component: Shopping });

type Row = { id: string; name: string; breed: string; code: string; supplier: string; qty: number; current: number };

const STEP = 10;
const roundTo10 = (n: number) => Math.max(0, Math.round(n / STEP) * STEP);
const ceilTo10 = (n: number) => Math.max(STEP, Math.ceil(n / STEP) * STEP);
const cartKey = (uid?: string) => (uid ? `agro_cart_${uid}` : null);

function Shopping() {
  const { data: bulls = [] } = useBulls();
  const { data: settings } = useSettings();
  const { user } = useSession();
  const minStock = settings?.minStock ?? 3;
  const [items, setItems] = useState<Row[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  // Por padrão todos os itens vão para o envio. Guardamos apenas os DESMARCADOS;
  // assim, novos itens entram automaticamente selecionados.
  const [unselected, setUnselected] = useState<Set<string>>(new Set());

  // Inicializa a partir dos touros com estoque baixo (soma conv + sex),
  // mesclando com rascunho salvo em localStorage.
  useEffect(() => {
    const key = cartKey(user?.id);
    let draft: Record<string, number> = {};
    if (key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { id: string; qty: number }[];
          draft = Object.fromEntries(parsed.map((r) => [r.id, r.qty]));
        }
      } catch {
        /* ignore */
      }
    }
    setItems((prev) => {
      const lows = bulls.filter((b) => b.quantity + b.quantitySexado <= minStock);
      const map = new Map(prev.map((p) => [p.id, p]));
      const lowIds = new Set(lows.map((b) => b.id));
      const base: Row[] = lows.map((b) => {
        const cur = b.quantity + b.quantitySexado;
        const suggested = ceilTo10(Math.max(minStock - cur, 1));
        const existing = map.get(b.id);
        const draftQty = draft[b.id];
        return {
          id: b.id, name: b.name, breed: b.breed, code: b.code, supplier: b.supplier,
          qty: existing?.qty ?? draftQty ?? suggested,
          current: cur,
        };
      });
      // Preserva itens adicionados manualmente (que ainda existem no banco).
      const manual: Row[] = [];
      const seen = new Set(base.map((r) => r.id));
      // Considera itens do rascunho que não estão em lows.
      for (const [id, qty] of Object.entries(draft)) {
        if (lowIds.has(id) || seen.has(id)) continue;
        const b = bulls.find((x) => x.id === id);
        if (!b) continue;
        manual.push({
          id: b.id, name: b.name, breed: b.breed, code: b.code, supplier: b.supplier,
          qty, current: b.quantity + b.quantitySexado,
        });
        seen.add(id);
      }
      // E itens do estado anterior (recém-adicionados nesta sessão).
      for (const p of prev) {
        if (seen.has(p.id)) continue;
        const b = bulls.find((x) => x.id === p.id);
        if (!b) continue;
        manual.push({
          id: b.id, name: b.name, breed: b.breed, code: b.code, supplier: b.supplier,
          qty: p.qty, current: b.quantity + b.quantitySexado,
        });
        seen.add(p.id);
      }
      return [...base, ...manual];
    });
  }, [bulls, minStock, user?.id]);

  // Limpa "desmarcados" que não estão mais na lista.
  useEffect(() => {
    setUnselected((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(items.map((r) => r.id));
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const isSelected = (id: string) => !unselected.has(id);

  const setQty = (id: string, n: number) =>
    setItems((it) => it.map((r) => (r.id === id ? { ...r, qty: Math.max(0, n) } : r)));
  const bumpQty = (id: string, delta: number) =>
    setItems((it) => it.map((r) => (r.id === id ? { ...r, qty: Math.max(0, r.qty + delta) } : r)));
  const normalizeQty = (id: string) =>
    setItems((it) => it.map((r) => (r.id === id ? { ...r, qty: roundTo10(r.qty) } : r)));
  const removeItem = (id: string) =>
    setItems((it) => it.filter((r) => r.id !== id));

  const toggleSelected = (id: string) =>
    setUnselected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const selectedCount = items.filter((r) => isSelected(r.id)).length;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const toggleAll = () => {
    if (allSelected) setUnselected(new Set(items.map((r) => r.id)));
    else setUnselected(new Set());
  };

  const addBull = (id: string) => {
    const b = bulls.find((x) => x.id === id);
    if (!b) return;
    setItems((it) => {
      if (it.some((r) => r.id === id)) {
        toast.info("Touro já está na lista");
        return it;
      }
      return [
        ...it,
        {
          id: b.id, name: b.name, breed: b.breed, code: b.code, supplier: b.supplier,
          qty: STEP, current: b.quantity + b.quantitySexado,
        },
      ];
    });
    setPickerOpen(false);
    setPickerQ("");
  };

  const pickerResults = bulls.filter((b) => {
    const s = pickerQ.toLowerCase();
    return !s || b.name.toLowerCase().includes(s) || b.code.toLowerCase().includes(s);
  });

  const saveDraft = () => {
    const key = cartKey(user?.id);
    if (!key) return toast.error("Faça login para salvar");
    localStorage.setItem(key, JSON.stringify(items.map((r) => ({ id: r.id, qty: r.qty }))));
    toast.success("Rascunho salvo");
  };

  const buildCoupon = () => {
    const date = new Date().toLocaleDateString("pt-BR");
    const picked = items.filter((r) => isSelected(r.id) && r.qty > 0);
    const totalDoses = picked.reduce((acc, r) => acc + r.qty, 0);
    const lines = picked
      .map(
        (r) =>
          `• ${r.name} (${r.breed}${r.code ? ` · ${r.code}` : ""})\n  Saldo: ${r.current} · Pedir: ${r.qty} doses`,
      )
      .join("\n");
    return (
      `🐂 PEDIDO DE SÊMEN — Agrosêmen\n` +
      `Data: ${date}\n` +
      (user?.name ? `Cliente: ${user.name}\n` : "") +
      `─────────────────────────\n` +
      `${lines}\n` +
      `─────────────────────────\n` +
      `Total de itens: ${picked.length}\n` +
      `Total de doses: ${totalDoses}`
    );
  };

  const removeSentItems = () => {
    const sentIds = new Set(
      items.filter((r) => isSelected(r.id) && r.qty > 0).map((r) => r.id),
    );
    if (sentIds.size === 0) return;
    const remaining = items.filter((r) => !sentIds.has(r.id));
    setItems(remaining);
    const key = cartKey(user?.id);
    if (key) {
      if (remaining.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(remaining.map((r) => ({ id: r.id, qty: r.qty }))));
    }
  };

  const sharePedido = async () => {
    if (items.length === 0) return toast.error("Lista vazia");
    const pickedCount = items.filter((r) => isSelected(r.id) && r.qty > 0).length;
    if (pickedCount === 0) return toast.error("Selecione ao menos um touro");
    const text = buildCoupon();
    const title = "Pedido de Sêmen — Agrosêmen";
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title, text });
        removeSentItems();
        toast.success("Pedido compartilhado");
        return;
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === "AbortError") return;
    }
    // Fallback: WhatsApp web + clipboard
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* ignore */
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    removeSentItems();
    toast.success("Texto copiado e WhatsApp aberto");
  };

  const exportCsv = () => {
    if (items.length === 0) return toast.error("Lista vazia");
    const picked = items.filter((r) => isSelected(r.id));
    if (picked.length === 0) return toast.error("Selecione ao menos um touro");
    const csv = "Nome,Raça,Código,Fornecedor,Estoque Atual,Comprar\n" +
      picked.map((b) => `${b.name},${b.breed},${b.code},${b.supplier},${b.current},${b.qty}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista-compras-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV baixado");
  };

  return (
    <AppLayout title="Lista de Compras">
      <p className="mb-3 text-sm text-muted-foreground">
        Touros com estoque ≤ {minStock}. Quantidades em pacotes de 10 doses.
      </p>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="mb-3 h-12 w-full justify-center text-base font-semibold">
            <PlusIcon className="mr-2 h-5 w-5" /> Adicionar Touro à Lista
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Touro</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus placeholder="Buscar por nome ou código"
              className="h-11 pl-9" value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)} />
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {pickerResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum touro encontrado
              </p>
            ) : (
              pickerResults.map((b) => {
                const inList = items.some((r) => r.id === b.id);
                return (
                  <button key={b.id} type="button" disabled={inList}
                    onClick={() => addBull(b.id)}
                    className="flex w-full items-center justify-between rounded-md border p-2 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{b.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {b.breed}{b.code ? ` · ${b.code}` : ""} · saldo {b.quantity + b.quantitySexado}
                      </p>
                    </div>
                    <span className="ml-2 shrink-0 text-xs font-medium text-primary">
                      {inList ? "✓ na lista" : "Adicionar"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum touro na lista. Use "Adicionar Touro à Lista" para incluir manualmente,
          ou aguarde até algum estoque ficar baixo.
        </Card>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{selectedCount} de {items.length} selecionado{items.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              onClick={toggleAll}
              className="font-medium text-primary hover:underline"
            >
              {allSelected ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>
          <div className="space-y-3">
            {items.map((b) => (
              <Card key={b.id} className={`p-3 transition-opacity ${isSelected(b.id) ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <Checkbox
                    checked={isSelected(b.id)}
                    onCheckedChange={() => toggleSelected(b.id)}
                    className="mt-1"
                    aria-label="Selecionar para o pedido"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.breed}{b.code ? ` · ${b.code}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-medium text-destructive">
                      Saldo Atual: {b.current} doses
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                    onClick={() => removeItem(b.id)} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-sm font-medium">
                    Pedir: <span className="text-primary">{b.qty}</span> doses
                  </span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-10 w-10"
                      onClick={() => bumpQty(b.id, -STEP)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      inputMode="numeric"
                      className="h-10 w-16 text-center font-semibold"
                      value={String(b.qty)}
                      onChange={(e) =>
                        setQty(b.id, parseInt(e.target.value.replace(/\D/g, "") || "0", 10))
                      }
                      onBlur={() => normalizeQty(b.id)}
                    />
                    <Button size="icon" variant="outline" className="h-10 w-10"
                      onClick={() => bumpQty(b.id, STEP)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <Button onClick={saveDraft} variant="secondary" size="lg" className="h-12 w-full text-base">
              <Save className="mr-2 h-5 w-5" /> Salvar Lista
            </Button>
            <Button onClick={sharePedido} size="lg" className="h-14 w-full text-base">
              <Share2 className="mr-2 h-5 w-5" /> Compartilhar Pedido
            </Button>
            <Button onClick={exportCsv} variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
              <Download className="mr-2 h-3 w-3" /> Baixar CSV
            </Button>
          </div>
        </>
      )}
    </AppLayout>
  );
}
