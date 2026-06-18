import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBulls, useAddInsemination, useSettings, useClients, useAddClient, type SemenType } from "@/lib/data";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/insemination")({ component: Page });

function Page() {
  const navigate = useNavigate();
  const { data: bulls = [] } = useBulls();
  const { data: settings } = useSettings();
  const { data: clients = [] } = useClients();
  const isCommercial = settings?.profile === "comercial";
  const addIns = useAddInsemination();
  const addClient = useAddClient();

  const [bullId, setBullId] = useState("");
  const [semenType, setSemenType] = useState<SemenType>("convencional");
  const [cowId, setCowId] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState("");

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncLoc, setNcLoc] = useState("");

  // Pré-carrega o valor padrão conforme o tipo de sêmen (perfil comercial)
  useEffect(() => {
    if (!isCommercial || !settings) return;
    const def = semenType === "convencional"
      ? settings.defaultPriceConvencional
      : settings.defaultPriceSexado;
    if (def) setPrice(String(def).replace(".", ","));
    else setPrice("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommercial, semenType, settings?.defaultPriceConvencional, settings?.defaultPriceSexado]);

  const selectedBull = bulls.find((b) => b.id === bullId);
  const stockOfType = selectedBull
    ? semenType === "sexado_macho" ? selectedBull.quantitySexadoMacho
      : semenType === "sexado_femea" ? selectedBull.quantitySexadoFemea
      : selectedBull.quantity
    : 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBull) return toast.error("Selecione um touro");
    if (stockOfType <= 0) return toast.error(`Estoque ${semenType} zerado para esse touro`);
    if (!cowId || !clientId) return toast.error("Preencha vaca e cliente");
    const client = clients.find((c) => c.id === clientId);
    if (!client) return toast.error("Cliente inválido");
    const p = isCommercial ? (parseFloat(price.replace(",", ".")) || 0) : 0;
    try {
      const [yy, mm, dd] = date.split("-").map(Number);
      const localNoon = new Date(yy, mm - 1, dd, 12, 0, 0);
      await addIns.mutateAsync({
        bull: selectedBull, cowId, client: client.name, clientId: client.id,
        date: localNoon.toISOString(), price: p, semenType,
      });
      toast.success("Inseminação registrada!");
      navigate({ to: "/history" });
    } catch (err) { console.error(err); toast.error("Erro ao salvar"); }
  };

  const createClient = async () => {
    if (!ncName.trim()) return toast.error("Nome do cliente é obrigatório");
    try {
      const id = await addClient.mutateAsync({
        name: ncName.trim(), phone: ncPhone.trim(), location: ncLoc.trim(),
      });
      setClientId(id);
      setNewClientOpen(false);
      setNcName(""); setNcPhone(""); setNcLoc("");
      toast.success("Cliente criado");
    } catch (e) { console.error(e); toast.error("Erro ao criar cliente"); }
  };

  return (
    <AppLayout title="Registrar Inseminação">
      <Card className="p-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Touro utilizado</Label>
            <Select value={bullId} onValueChange={setBullId}>
              <SelectTrigger className="h-12"><SelectValue placeholder="Selecionar touro" /></SelectTrigger>
              <SelectContent>
                {bulls.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} · C {b.quantity} / ♂ {b.quantitySexadoMacho} / ♀ {b.quantitySexadoFemea}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de sêmen</Label>
            <Select value={semenType} onValueChange={(v) => setSemenType(v as SemenType)}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="convencional">Convencional</SelectItem>
                <SelectItem value="sexado_macho">Sexado ♂ (Macho)</SelectItem>
                <SelectItem value="sexado_femea">Sexado ♀ (Fêmea)</SelectItem>
              </SelectContent>
            </Select>
            {selectedBull && (
              <p className="text-xs text-muted-foreground">Saldo disponível: {stockOfType}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Identificação da Vaca (brinco/nº)</Label>
            <Input value={cowId} onChange={(e) => setCowId(e.target.value)} className="h-12 text-base" />
          </div>

          <div className="space-y-2">
            <Label>Cliente / Fazenda</Label>
            <div className="flex gap-2">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-12 flex-1"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">Nenhum cliente cadastrado</div>
                  ) : clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" className="h-12" onClick={() => setNewClientOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className={isCommercial ? "grid grid-cols-2 gap-3" : ""}>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 text-base" />
            </div>
            {isCommercial && (
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="h-12 text-base" />
              </div>
            )}
          </div>

          <Button type="submit" size="lg" className="h-14 w-full text-base">Salvar inseminação</Button>
        </form>
      </Card>

      <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={ncName} onChange={(e) => setNcName(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1">
              <Label>Telefone / WhatsApp</Label>
              <Input value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1">
              <Label>Propriedade / Localização</Label>
              <Input value={ncLoc} onChange={(e) => setNcLoc(e.target.value)} className="h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewClientOpen(false)}>Cancelar</Button>
            <Button onClick={createClient}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
