import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBulls, useAddBull, useAdjustBullQuantity, useUpdateBull, type Bull, type SemenType } from "@/lib/data";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { BREEDS_CORTE, BREEDS_LEITE } from "@/lib/breeds";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/stock-in")({ component: StockIn });

/* Per-type form slot */
type Slot = {
  qty: string; price: string; code: string; canister: string; botijao: string;
};
const EMPTY_SLOT: Slot = { qty: "", price: "", code: "", canister: "", botijao: "" };

const TYPE_LABEL: Record<Exclude<SemenType, never>, string> = {
  convencional: "Convencional",
  sexado_macho: "Sexado ♂ (Macho)",
  sexado_femea: "Sexado ♀ (Fêmea)",
};

function SlotCard({
  title, currentQty, slot, onChange,
}: {
  title: string;
  currentQty?: number;
  slot: Slot;
  onChange: (s: Slot) => void;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        {currentQty !== undefined && (
          <span className="text-xs text-muted-foreground">Atual: {currentQty}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Quantidade</Label>
          <Input inputMode="numeric" value={slot.qty}
            onChange={(e) => onChange({ ...slot, qty: e.target.value.replace(/\D/g, "") })}
            placeholder="0" className="h-11" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor (R$)</Label>
          <Input inputMode="decimal" value={slot.price}
            onChange={(e) => onChange({ ...slot, price: e.target.value })}
            placeholder="0,00" className="h-11" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Código/Registro da Palheta</Label>
        <Input value={slot.code}
          onChange={(e) => onChange({ ...slot, code: e.target.value })}
          className="h-11" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Caneca</Label>
          <Input value={slot.canister}
            onChange={(e) => onChange({ ...slot, canister: e.target.value })}
            placeholder="Ex: 01" className="h-11" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Botijão</Label>
          <Input value={slot.botijao}
            onChange={(e) => onChange({ ...slot, botijao: e.target.value })}
            placeholder="Ex: A1" className="h-11" />
        </div>
      </div>
    </div>
  );
}

function StockIn() {
  const { data: bulls = [] } = useBulls();
  const addBull = useAddBull();
  const adjustBull = useAdjustBullQuantity();
  const updateBull = useUpdateBull();

  // Existing — separate slots per type (only qty is required to add to stock)
  const [existingId, setExistingId] = useState("");
  const [exConv, setExConv] = useState<Slot>(EMPTY_SLOT);
  const [exMacho, setExMacho] = useState<Slot>(EMPTY_SLOT);
  const [exFemea, setExFemea] = useState<Slot>(EMPTY_SLOT);

  // New
  const [name, setName] = useState("");
  const [breedSel, setBreedSel] = useState("");
  const [breedOther, setBreedOther] = useState("");
  const [supplier, setSupplier] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [newConv, setNewConv] = useState<Slot>(EMPTY_SLOT);
  const [newMacho, setNewMacho] = useState<Slot>(EMPTY_SLOT);
  const [newFemea, setNewFemea] = useState<Slot>(EMPTY_SLOT);
  const [dupCodeBull, setDupCodeBull] = useState<Bull | null>(null);

  const onPhoto = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(file);
  };

  const selectedBull = bulls.find((b) => b.id === existingId);

  const onSelectExisting = (v: string) => {
    setExistingId(v);
    const sel = bulls.find((b) => b.id === v);
    if (!sel) {
      setExConv(EMPTY_SLOT); setExMacho(EMPTY_SLOT); setExFemea(EMPTY_SLOT);
      return;
    }
    setExConv({ qty: "", price: "", code: sel.codeConvencional, canister: sel.canisterConvencional, botijao: sel.botijaoConvencional });
    setExMacho({ qty: "", price: "", code: sel.codeSexadoMacho, canister: sel.canisterSexadoMacho, botijao: sel.botijaoSexadoMacho });
    setExFemea({ qty: "", price: "", code: sel.codeSexadoFemea, canister: sel.canisterSexadoFemea, botijao: sel.botijaoSexadoFemea });
  };

  const addToExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBull) return toast.error("Selecione um touro");
    const qc = parseInt(exConv.qty, 10) || 0;
    const qm = parseInt(exMacho.qty, 10) || 0;
    const qf = parseInt(exFemea.qty, 10) || 0;
    if (qc <= 0 && qm <= 0 && qf <= 0)
      return toast.error("Informe quantidade em pelo menos um tipo");
    try {
      // Update bull metadata (code/caneca/botijão/price) for each touched slot
      const updated: Bull = {
        ...selectedBull,
        codeConvencional: exConv.code, canisterConvencional: exConv.canister, botijaoConvencional: exConv.botijao,
        codeSexadoMacho: exMacho.code, canisterSexadoMacho: exMacho.canister, botijaoSexadoMacho: exMacho.botijao,
        codeSexadoFemea: exFemea.code, canisterSexadoFemea: exFemea.canister, botijaoSexadoFemea: exFemea.botijao,
        priceConvencional: exConv.price ? parseFloat(exConv.price.replace(",", ".")) || selectedBull.priceConvencional : selectedBull.priceConvencional,
        priceSexadoMacho: exMacho.price ? parseFloat(exMacho.price.replace(",", ".")) || selectedBull.priceSexadoMacho : selectedBull.priceSexadoMacho,
        priceSexadoFemea: exFemea.price ? parseFloat(exFemea.price.replace(",", ".")) || selectedBull.priceSexadoFemea : selectedBull.priceSexadoFemea,
      };
      await updateBull.mutateAsync(updated);

      if (qc > 0) {
        await adjustBull.mutateAsync({ bull: updated, newQuantity: updated.quantity + qc, type: "entry", semenType: "convencional" });
      }
      if (qm > 0) {
        await adjustBull.mutateAsync({ bull: updated, newQuantity: updated.quantitySexadoMacho + qm, type: "entry", semenType: "sexado_macho" });
      }
      if (qf > 0) {
        await adjustBull.mutateAsync({ bull: updated, newQuantity: updated.quantitySexadoFemea + qf, type: "entry", semenType: "sexado_femea" });
      }
      const parts: string[] = [];
      if (qc > 0) parts.push(`+${qc} conv`);
      if (qm > 0) parts.push(`+${qm} sex♂`);
      if (qf > 0) parts.push(`+${qf} sex♀`);
      toast.success(`${parts.join(" · ")} em ${selectedBull.name}`);
      setExConv((s) => ({ ...s, qty: "" }));
      setExMacho((s) => ({ ...s, qty: "" }));
      setExFemea((s) => ({ ...s, qty: "" }));
    } catch (err) { console.error(err); toast.error("Erro ao salvar"); }
  };

  const performCreate = async () => {
    const finalBreed = breedSel === "Outra" ? breedOther.trim() : breedSel;
    try {
      await addBull.mutateAsync({
        name, breed: finalBreed, supplier, photo,
        quantity: parseInt(newConv.qty, 10) || 0,
        priceConvencional: parseFloat(newConv.price.replace(",", ".")) || 0,
        codeConvencional: newConv.code, canisterConvencional: newConv.canister, botijaoConvencional: newConv.botijao,
        quantitySexadoMacho: parseInt(newMacho.qty, 10) || 0,
        priceSexadoMacho: parseFloat(newMacho.price.replace(",", ".")) || 0,
        codeSexadoMacho: newMacho.code, canisterSexadoMacho: newMacho.canister, botijaoSexadoMacho: newMacho.botijao,
        quantitySexadoFemea: parseInt(newFemea.qty, 10) || 0,
        priceSexadoFemea: parseFloat(newFemea.price.replace(",", ".")) || 0,
        codeSexadoFemea: newFemea.code, canisterSexadoFemea: newFemea.canister, botijaoSexadoFemea: newFemea.botijao,
        // derived legacy
        code: newConv.code || newMacho.code || newFemea.code,
        location: newConv.canister || newMacho.canister || newFemea.canister,
        quantitySexado: (parseInt(newMacho.qty, 10) || 0) + (parseInt(newFemea.qty, 10) || 0),
        priceSexado: parseFloat(newMacho.price.replace(",", ".")) || parseFloat(newFemea.price.replace(",", ".")) || 0,
      });
      toast.success(`Touro ${name} cadastrado`);
      setName(""); setBreedSel(""); setBreedOther(""); setSupplier(""); setPhoto("");
      setNewConv(EMPTY_SLOT); setNewMacho(EMPTY_SLOT); setNewFemea(EMPTY_SLOT);
    } catch (err) { console.error(err); toast.error("Erro ao cadastrar"); }
  };

  const createNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBreed = breedSel === "Outra" ? breedOther.trim() : breedSel;
    if (!name || !finalBreed) return toast.error("Preencha nome e raça");
    const anyCode = (newConv.code || newMacho.code || newFemea.code).trim();
    if (!anyCode) return toast.error("Preencha o código de pelo menos um tipo de sêmen");
    const nName = name.trim().toLowerCase();
    const nCode = anyCode.toLowerCase();
    const dupSame = bulls.find(
      (b) => b.name.trim().toLowerCase() === nName && b.code.trim().toLowerCase() === nCode,
    );
    if (dupSame) {
      return toast.error(
        `Já existe um touro com o nome "${dupSame.name}" e código "${dupSame.code}". Use a aba "Touro existente" para adicionar estoque.`,
      );
    }
    const dupCode = bulls.find((b) => b.code.trim().toLowerCase() === nCode);
    if (dupCode) {
      setDupCodeBull(dupCode);
      return;
    }
    await performCreate();
  };

  return (
    <AppLayout title="Entrada de Estoque">
      <Tabs defaultValue="existing">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="existing">Touro existente</TabsTrigger>
          <TabsTrigger value="new">Novo touro</TabsTrigger>
        </TabsList>

        <TabsContent value="existing">
          <Card className="p-4">
            {bulls.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum touro cadastrado ainda.</p>
            ) : (
              <form onSubmit={addToExisting} className="space-y-4">
                <div className="space-y-2">
                  <Label>Touro</Label>
                  <Select value={existingId} onValueChange={onSelectExisting}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {bulls.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} · C {b.quantity} / ♂ {b.quantitySexadoMacho} / ♀ {b.quantitySexadoFemea}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <SlotCard title={TYPE_LABEL.convencional} currentQty={selectedBull?.quantity}
                  slot={exConv} onChange={setExConv} />
                <SlotCard title={TYPE_LABEL.sexado_macho} currentQty={selectedBull?.quantitySexadoMacho}
                  slot={exMacho} onChange={setExMacho} />
                <SlotCard title={TYPE_LABEL.sexado_femea} currentQty={selectedBull?.quantitySexadoFemea}
                  slot={exFemea} onChange={setExFemea} />

                <Button
                  size="lg" type="submit" className="h-14 w-full text-base"
                  disabled={adjustBull.isPending || updateBull.isPending}
                >
                  {adjustBull.isPending || updateBull.isPending ? "Adicionando..." : "Adicionar ao estoque"}
                </Button>
              </form>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="new">
          <Card className="p-4">
            <form onSubmit={createNew} className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="relative h-20 w-20 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed bg-muted">
                  {photo ? (
                    <img src={photo} alt="touro" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                      <Camera className="h-6 w-6" />
                      <span className="text-[10px]">Foto</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => onPhoto(e.target.files?.[0])} />
                </label>
                <p className="text-xs text-muted-foreground">Toque para usar câmera ou galeria</p>
              </div>
              <div className="space-y-2">
                <Label>Nome do Touro *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" required />
              </div>
              <div className="space-y-2">
                <Label>Raça *</Label>
                <Select value={breedSel} onValueChange={setBreedSel}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Selecionar raça" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Corte</SelectLabel>
                      {BREEDS_CORTE.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Leite / Dupla Aptidão</SelectLabel>
                      {BREEDS_LEITE.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectGroup>
                    <SelectItem value="Outra">Outra (Digitar…)</SelectItem>
                  </SelectContent>
                </Select>
                {breedSel === "Outra" && (
                  <Input placeholder="Digite a raça"
                    value={breedOther}
                    onChange={(e) => setBreedOther(e.target.value)}
                    className="h-12 text-base" />
                )}
              </div>
              <div className="space-y-2">
                <Label>Central/Empresa fornecedora</Label>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="h-12 text-base" />
              </div>

              <SlotCard title={TYPE_LABEL.convencional} slot={newConv} onChange={setNewConv} />
              <SlotCard title={TYPE_LABEL.sexado_macho} slot={newMacho} onChange={setNewMacho} />
              <SlotCard title={TYPE_LABEL.sexado_femea} slot={newFemea} onChange={setNewFemea} />

              <Button
                size="lg" type="submit" className="h-14 w-full text-base"
                disabled={addBull.isPending}
              >
                {addBull.isPending ? "Salvando..." : "Cadastrar touro"}
              </Button>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
      <AlertDialog open={!!dupCodeBull} onOpenChange={(o) => { if (!o) setDupCodeBull(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Código já cadastrado</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um touro com o código "{dupCodeBull?.code}" cadastrado com o nome "{dupCodeBull?.name}". Tem certeza que deseja manter este cadastro com o nome "{name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { setDupCodeBull(null); await performCreate(); }}
            >
              Sim, cadastrar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
