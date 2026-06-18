import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBulls, useClients, useSettings, useUpdateInsemination, type Insemination, type SemenType } from "@/lib/data";
import { toast } from "sonner";

export function EditInseminationDialog({
  ins, open, onOpenChange,
}: {
  ins: Insemination | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: bulls = [] } = useBulls();
  const { data: clients = [] } = useClients();
  const { data: settings } = useSettings();
  const isCommercial = settings?.profile === "comercial";
  const update = useUpdateInsemination();

  const [bullId, setBullId] = useState("");
  const [semenType, setSemenType] = useState<SemenType>("convencional");
  const [cowId, setCowId] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (!ins) return;
    setBullId(ins.bullId ?? "");
    const t = ((ins.semenType as string) === "sexado" ? "sexado_macho" : ins.semenType) as SemenType;
    setSemenType(t);
    setCowId(ins.cowId);
    setClientId(ins.clientId ?? "");
    setClientName(ins.client);
    const d = new Date(ins.date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
    setPrice(String(ins.price ?? 0).replace(".", ","));
  }, [ins]);

  const selectedBull = bulls.find((b) => b.id === bullId);
  const stockOfType = selectedBull
    ? semenType === "sexado_macho" ? selectedBull.quantitySexadoMacho
      : semenType === "sexado_femea" ? selectedBull.quantitySexadoFemea
      : selectedBull.quantity
    : 0;

  const prevBullId = ins?.bullId ?? null;
  const prevType = ins ? (((ins.semenType as string) === "sexado" ? "sexado_macho" : ins.semenType) as SemenType) : "convencional";
  const stockWillChange = ins ? (prevBullId !== bullId || prevType !== semenType) : false;

  const onSave = async () => {
    if (!ins) return;
    if (!selectedBull) return toast.error("Selecione um touro");
    if (!cowId.trim()) return toast.error("Informe a vaca");
    if (stockWillChange && stockOfType <= 0) {
      return toast.error("Sem saldo do tipo selecionado para esse touro");
    }
    const finalClient = clientId
      ? (clients.find((c) => c.id === clientId)?.name ?? clientName)
      : clientName;
    const p = isCommercial ? (parseFloat(price.replace(",", ".")) || 0) : ins.price;
    try {
      const [yy, mm, dd] = date.split("-").map(Number);
      const localNoon = new Date(yy, mm - 1, dd, 12, 0, 0);
      await update.mutateAsync({
        id: ins.id,
        bullId: selectedBull.id,
        bullName: selectedBull.name,
        cowId: cowId.trim(),
        client: finalClient || "Cliente sem identificação",
        clientId: clientId || null,
        date: localNoon.toISOString(),
        price: p,
        semenType,
      });
      toast.success("Inseminação atualizada");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || "Erro ao atualizar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar inseminação</DialogTitle>
          <DialogDescription>
            Ajuste os dados do registro. Trocar touro ou tipo de sêmen reequilibra o estoque.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Touro</Label>
            <Select value={bullId} onValueChange={setBullId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar touro" /></SelectTrigger>
              <SelectContent>
                {bulls.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} · C {b.quantity} / ♂ {b.quantitySexadoMacho} / ♀ {b.quantitySexadoFemea}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Tipo de sêmen</Label>
            <Select value={semenType} onValueChange={(v) => setSemenType(v as SemenType)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="convencional">Convencional</SelectItem>
                <SelectItem value="sexado_macho">Sexado ♂ (Macho)</SelectItem>
                <SelectItem value="sexado_femea">Sexado ♀ (Fêmea)</SelectItem>
              </SelectContent>
            </Select>
            {selectedBull && stockWillChange && (
              <p className="text-xs text-muted-foreground">Saldo disponível: {stockOfType}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Vaca (brinco/nº)</Label>
            <Input value={cowId} onChange={(e) => setCowId(e.target.value)} className="h-11" />
          </div>

          <div className="space-y-1">
            <Label>Cliente</Label>
            <Select
              value={clientId || "__none__"}
              onValueChange={(v) => {
                if (v === "__none__") {
                  setClientId("");
                } else {
                  setClientId(v);
                  const c = clients.find((x) => x.id === v);
                  if (c) setClientName(c.name);
                }
              }}
            >
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem cliente cadastrado ({clientName || "—"}) —</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!clientId && (
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome do cliente"
                className="h-11"
              />
            )}
          </div>

          <div className={isCommercial ? "grid grid-cols-2 gap-3" : ""}>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
            </div>
            {isCommercial && (
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="h-11" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={update.isPending} className="bg-blue-600 text-white hover:bg-blue-700">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}