import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBulls, useImportBulls, useAddInsemination, useSettings, useSession, type Bull, type SemenType } from "@/lib/data";
import { EditBullDialog } from "@/components/EditBullDialog";
import { Pencil, Upload, Search, LayoutGrid, List as ListIcon, Syringe, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ALL_BREEDS } from "@/lib/breeds";

export const Route = createFileRoute("/products")({ component: Products });

function Products() {
  const { data: bulls = [] } = useBulls();
  const importBulls = useImportBulls();
  const addInsemination = useAddInsemination();
  const { data: settings } = useSettings();
  const { user } = useSession();
  const [q, setQ] = useState("");
  const [breed, setBreed] = useState("Todas");
  const [editing, setEditing] = useState<Bull | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [photoOpen, setPhotoOpen] = useState<Bull | null>(null);
  const [quickBull, setQuickBull] = useState<Bull | null>(null);
  const [quickType, setQuickType] = useState<SemenType>("convencional");

  const renderBadges = (b: Bull) => {
    const fmtLoc = (caneca: string, botijao: string) => {
      const c = caneca?.trim();
      const bt = botijao?.trim();
      if (!c && !bt) return "";
      if (c && bt) return ` - Caneca ${c} | Bot. ${bt}`;
      if (c) return ` - Caneca ${c}`;
      return ` - Bot. ${bt}`;
    };
    const items: { key: string; cls: string; text: string }[] = [];
    if (b.quantity > 0) {
      items.push({
        key: "c",
        cls: "bg-green-700 text-white",
        text: `C ${b.quantity}${fmtLoc(b.canisterConvencional, b.botijaoConvencional)}`,
      });
    }
    if (b.quantitySexadoMacho > 0) {
      items.push({
        key: "m",
        cls: "bg-sky-200 text-sky-900",
        text: `♂ S ${b.quantitySexadoMacho}${fmtLoc(b.canisterSexadoMacho, b.botijaoSexadoMacho)}`,
      });
    }
    if (b.quantitySexadoFemea > 0) {
      items.push({
        key: "f",
        cls: "bg-pink-200 text-pink-900",
        text: `♀ S ${b.quantitySexadoFemea}${fmtLoc(b.canisterSexadoFemea, b.botijaoSexadoFemea)}`,
      });
    }
    return items;
  };

  const filtered = useMemo(
    () =>
      bulls.filter(
        (b) =>
          (breed === "Todas" || b.breed === breed) &&
          (b.name.toLowerCase().includes(q.toLowerCase()) ||
            b.code.toLowerCase().includes(q.toLowerCase())),
      ),
    [bulls, q, breed],
  );

  const totalDoses = useMemo(
    () => bulls.reduce((acc, b) => acc + b.quantity + b.quantitySexado, 0),
    [bulls],
  );

  const breedOptions = useMemo(() => {
    const fromData = bulls.map((b) => b.breed).filter(Boolean);
    const set = new Set<string>([...ALL_BREEDS, ...fromData]);
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [bulls]);

  const grouped = useMemo(() => {
    const map = new Map<string, Bull[]>();
    filtered.forEach((b) => {
      const key = b.breed || "Sem raça";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [filtered]);

  const openQuick = (b: Bull) => {
    if (b.quantity <= 0 && b.quantitySexadoMacho <= 0 && b.quantitySexadoFemea <= 0) {
      toast.error("Sem doses disponíveis");
      return;
    }
    const initial: SemenType =
      b.quantity > 0 ? "convencional"
      : b.quantitySexadoMacho > 0 ? "sexado_macho"
      : "sexado_femea";
    setQuickType(initial);
    setQuickBull(b);
  };

  const confirmQuick = async () => {
    if (!quickBull) return;
    const current =
      quickType === "sexado_macho" ? quickBull.quantitySexadoMacho
      : quickType === "sexado_femea" ? quickBull.quantitySexadoFemea
      : quickBull.quantity;
    if (current <= 0) return toast.error("Sem saldo deste tipo");
    const bullPrice =
      quickType === "sexado_macho" ? quickBull.priceSexadoMacho
      : quickType === "sexado_femea" ? quickBull.priceSexadoFemea
      : quickBull.priceConvencional;
    const defaultPrice = quickType === "convencional"
      ? (settings?.defaultPriceConvencional ?? 0)
      : (settings?.defaultPriceSexado ?? 0);
    const price = bullPrice > 0 ? bullPrice : defaultPrice;
    try {
      await addInsemination.mutateAsync({
        bull: quickBull,
        cowId: "",
        client: "Cliente sem identificação",
        clientId: null,
        date: new Date().toISOString(),
        price,
        semenType: quickType,
      });
      toast.success("Aplicação registrada — Cliente sem identificação");
      setQuickBull(null);
    } catch (e) { console.error(e); toast.error("Erro ao registrar baixa"); }
  };

  const onImport = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      const text = r.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const [, ...rows] = lines;
      const imported: Omit<Bull, "id">[] = [];
      rows.forEach((line) => {
        const cells = line.split(/[,;]/).map((c) => c.trim());
        const [nm, br, cd, sp, qt, lc] = cells;
        if (!nm) return;
        imported.push({
          name: nm, breed: br || "Nelore",
          supplier: sp || "",
          quantity: parseInt(qt, 10) || 0,
          priceConvencional: 0,
          codeConvencional: cd || "", canisterConvencional: lc || "", botijaoConvencional: "",
          quantitySexadoMacho: 0, priceSexadoMacho: 0,
          codeSexadoMacho: "", canisterSexadoMacho: "", botijaoSexadoMacho: "",
          quantitySexadoFemea: 0, priceSexadoFemea: 0,
          codeSexadoFemea: "", canisterSexadoFemea: "", botijaoSexadoFemea: "",
          // legacy derived
          code: cd || "", location: lc || "", quantitySexado: 0, priceSexado: 0,
        });
      });
      if (imported.length === 0) return toast.error("Nenhuma linha válida");
      try {
        await importBulls.mutateAsync(imported);
        toast.success(`${imported.length} touros importados`);
      } catch (err) { console.error(err); toast.error("Erro ao importar"); }
    };
    r.readAsText(file);
  };

  return (
    <AppLayout
      title="Estoque"
      subtitle={`Total: ${totalDoses} doses em ${bulls.length} touros`}
    >
      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou código" value={q}
              onChange={(e) => setQ(e.target.value)} className="h-12 pl-9 text-base" />
          </div>
          <Button
            size="icon"
            onClick={async () => {
              if (!user) return;
              if (!settings?.whatsappNumber) {
                toast.error("Configure seu WhatsApp em Configurações para gerar o link");
                return;
              }
              const url = `${window.location.origin}/catalogo/${user.id}`;
              const text = `Confira nosso catálogo de touros: ${url}`;
              const nav = navigator as Navigator & {
                share?: (d: { title?: string; text?: string; url?: string }) => Promise<void>;
              };
              try {
                if (nav.share) {
                  await nav.share({ title: "Catálogo de Touros", text, url });
                } else {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copiado");
                }
              } catch (err) {
                if ((err as DOMException)?.name !== "AbortError") {
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("Link copiado");
                  } catch { toast.error("Não foi possível compartilhar"); }
                }
              }
            }}
            aria-label="Compartilhar catálogo"
            className="h-12 w-12 shrink-0 bg-blue-600 text-white hover:bg-blue-700"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={breed} onValueChange={setBreed}>
            <SelectTrigger className="h-11 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {breedOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setView(view === "list" ? "grid" : "list")}
            aria-label="Alternar visualização"
          >
            {view === "list" ? <LayoutGrid className="h-4 w-4" /> : <ListIcon className="h-4 w-4" />}
          </Button>
          <label>
            <input type="file" accept=".csv,.txt" className="hidden"
              onChange={(e) => onImport(e.target.files?.[0])} />
            <Button asChild variant="outline" className="h-11">
              <span><Upload className="mr-2 h-4 w-4" /> Importar</span>
            </Button>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum touro encontrado.</Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([breedName, items]) => (
            <section key={breedName}>
              <div className="mb-3 flex items-center justify-between rounded-none bg-primary px-4 py-2 text-primary-foreground">
                <span className="text-sm font-bold uppercase tracking-wide">
                  {breedName}
                </span>
                <span className="text-xs font-medium text-primary-foreground/85">
                  {items.length} touro{items.length > 1 ? "s" : ""}
                </span>
              </div>
              {view === "list" ? (
                <div className="space-y-2">
                  {items.map((b) => (
                    <Card key={b.id} className="flex items-center gap-3 p-3">
                      {b.photo ? (
                        <img src={b.photo} alt={b.name} onClick={() => setPhotoOpen(b)}
                          className="h-14 w-14 cursor-pointer rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">s/foto</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{b.breed} · {b.code}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {renderBadges(b).map((it) => (
                            <span key={it.key} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${it.cls}`}>
                              {it.text}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="icon"
                          onClick={() => openQuick(b)}
                          className="h-10 w-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          aria-label="Baixa rápida"
                        >
                          <span className="relative inline-flex">
                            <Syringe className="h-4 w-4" />
                            <span className="absolute -right-1 -top-1 text-[10px] font-bold leading-none">+</span>
                          </span>
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => setEditing(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {items.map((b) => (
                    <Card key={b.id} className="overflow-hidden p-2">
                      {b.photo ? (
                        <img src={b.photo} alt={b.name} onClick={() => setPhotoOpen(b)}
                          className="aspect-square w-full cursor-pointer rounded-md object-cover" />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">s/foto</div>
                      )}
                      <div className="mt-2 min-w-0">
                        <p className="truncate text-sm font-semibold">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{b.breed} · {b.code}</p>
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => openQuick(b)}
                          aria-label="Baixa rápida"
                          className="group flex w-full items-center justify-center gap-3 rounded-xl border border-blue-200 bg-blue-100 px-4 py-3 transition-colors active:bg-blue-200"
                        >
                          <span className="relative inline-flex items-center justify-center">
                            <Syringe className="h-5 w-5 text-blue-700" />
                            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                              +
                            </span>
                          </span>
                          <span className="text-sm font-bold uppercase tracking-tight text-blue-800">Aplicar</span>
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1 text-[10px]">
                        <div className="flex flex-1 flex-wrap items-center gap-1">
                          {renderBadges(b).map((it) => (
                            <span key={it.key} className={`rounded px-1.5 py-0.5 font-bold ${it.cls}`}>
                              {it.text}
                            </span>
                          ))}
                        </div>
                        <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => setEditing(b)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <EditBullDialog bull={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />

      <Dialog open={!!photoOpen} onOpenChange={(o) => !o && setPhotoOpen(null)}>
        <DialogContent className="max-w-screen-md p-2">
          <DialogHeader className="px-2 pt-2">
            <DialogTitle>{photoOpen?.name}</DialogTitle>
          </DialogHeader>
          {photoOpen?.photo && (
            <img src={photoOpen.photo} alt={photoOpen.name} className="max-h-[85vh] w-full rounded-md object-contain" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!quickBull} onOpenChange={(o) => !o && setQuickBull(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar aplicação</DialogTitle>
            <DialogDescription>
              Registrar aplicação de sêmen do Touro <b>{quickBull?.name}</b>?
            </DialogDescription>
          </DialogHeader>
          {quickBull && (() => {
            const opts: { type: SemenType; label: string; qty: number }[] = (
              [
                { type: "convencional", label: "Convencional", qty: quickBull.quantity },
                { type: "sexado_macho", label: "Sexado ♂", qty: quickBull.quantitySexadoMacho },
                { type: "sexado_femea", label: "Sexado ♀", qty: quickBull.quantitySexadoFemea },
              ] as { type: SemenType; label: string; qty: number }[]
            ).filter((o) => o.qty > 0);
            if (opts.length <= 1) {
              const only = opts[0];
              return only ? (
                <p className="text-sm text-muted-foreground">
                  Tipo: <b>{only.label}</b> ({only.qty} dose(s))
                </p>
              ) : null;
            }
            return (
              <div className={`grid gap-2 ${opts.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {opts.map((o) => (
                  <Button key={o.type}
                    variant={quickType === o.type ? "default" : "outline"}
                    onClick={() => setQuickType(o.type)}
                    className={`h-14 ${
                      o.type === "sexado_macho"
                        ? quickType === o.type
                          ? "bg-sky-500 text-white hover:bg-sky-500"
                          : "border-sky-500 bg-sky-200 text-sky-900 hover:bg-sky-300"
                        : o.type === "sexado_femea"
                        ? quickType === o.type
                          ? "bg-pink-500 text-white hover:bg-pink-500"
                          : "border-pink-500 bg-pink-200 text-pink-900 hover:bg-pink-300"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm">
                        {o.type === "sexado_macho" ? (
                          <>Sexado <span className="text-lg font-black">♂</span></>
                        ) : o.type === "sexado_femea" ? (
                          <>Sexado <span className="text-lg font-black">♀</span></>
                        ) : (
                          o.label
                        )}
                      </span>
                      <span className="text-[11px] opacity-80">{o.qty} dose(s)</span>
                    </div>
                  </Button>
                ))}
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setQuickBull(null)}>Cancelar</Button>
            <Button
              onClick={confirmQuick}
              disabled={addInsemination.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
