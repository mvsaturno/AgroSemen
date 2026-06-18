import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Trash2 } from "lucide-react";
import { useUpdateBull, useDeleteBull, type Bull } from "@/lib/data";
import { toast } from "sonner";
import { BREEDS_CORTE, BREEDS_LEITE, isKnownBreed } from "@/lib/breeds";

export function EditBullDialog({
  bull, open, onOpenChange,
}: {
  bull: Bull | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdateBull();
  const del = useDeleteBull();

  type Slot = { qty: string; price: string; code: string; canister: string; botijao: string };
  const EMPTY: Slot = { qty: "0", price: "0", code: "", canister: "", botijao: "" };

  const [name, setName] = useState("");
  const [breedSel, setBreedSel] = useState("Nelore");
  const [breedOther, setBreedOther] = useState("");
  const [supplier, setSupplier] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [conv, setConv] = useState<Slot>(EMPTY);
  const [macho, setMacho] = useState<Slot>(EMPTY);
  const [femea, setFemea] = useState<Slot>(EMPTY);

  useEffect(() => {
    if (!bull) return;
    setName(bull.name);
    if (isKnownBreed(bull.breed)) { setBreedSel(bull.breed); setBreedOther(""); }
    else { setBreedSel("Outra"); setBreedOther(bull.breed); }
    setSupplier(bull.supplier);
    setPhoto(bull.photo ?? "");
    setConv({ qty: String(bull.quantity), price: String(bull.priceConvencional),
      code: bull.codeConvencional, canister: bull.canisterConvencional, botijao: bull.botijaoConvencional });
    setMacho({ qty: String(bull.quantitySexadoMacho), price: String(bull.priceSexadoMacho),
      code: bull.codeSexadoMacho, canister: bull.canisterSexadoMacho, botijao: bull.botijaoSexadoMacho });
    setFemea({ qty: String(bull.quantitySexadoFemea), price: String(bull.priceSexadoFemea),
      code: bull.codeSexadoFemea, canister: bull.canisterSexadoFemea, botijao: bull.botijaoSexadoFemea });
  }, [bull]);

  const onPhoto = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(file);
  };

  const save = async () => {
    if (!bull) return;
    const finalBreed = breedSel === "Outra" ? breedOther.trim() : breedSel;
    if (!name || !finalBreed) return toast.error("Preencha nome e raça");
    const qC = parseInt(conv.qty, 10) || 0;
    const qM = parseInt(macho.qty, 10) || 0;
    const qF = parseInt(femea.qty, 10) || 0;
    const pC = parseFloat(conv.price.replace(",", ".")) || 0;
    const pM = parseFloat(macho.price.replace(",", ".")) || 0;
    const pF = parseFloat(femea.price.replace(",", ".")) || 0;
    try {
      await update.mutateAsync({
        id: bull.id, name, breed: finalBreed, supplier,
        photo: photo || null,
        quantity: qC, priceConvencional: pC,
        codeConvencional: conv.code, canisterConvencional: conv.canister, botijaoConvencional: conv.botijao,
        quantitySexadoMacho: qM, priceSexadoMacho: pM,
        codeSexadoMacho: macho.code, canisterSexadoMacho: macho.canister, botijaoSexadoMacho: macho.botijao,
        quantitySexadoFemea: qF, priceSexadoFemea: pF,
        codeSexadoFemea: femea.code, canisterSexadoFemea: femea.canister, botijaoSexadoFemea: femea.botijao,
        // legacy derived
        code: conv.code || macho.code || femea.code,
        location: conv.canister || macho.canister || femea.canister,
        quantitySexado: qM + qF,
        priceSexado: pM || pF,
      });
      toast.success("Touro atualizado");
      onOpenChange(false);
    } catch (e) { console.error(e); toast.error("Erro ao salvar"); }
  };

  const onDelete = async () => {
    if (!bull) return;
    try {
      await del.mutateAsync(bull.id);
      toast.success("Touro excluído");
      onOpenChange(false);
    } catch (e) { console.error(e); toast.error("Erro ao excluir"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar touro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
            <p className="text-xs text-muted-foreground">Toque para trocar a foto</p>
          </div>

          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </div>

          <div className="space-y-2">
            <Label>Raça</Label>
            <Select value={breedSel} onValueChange={setBreedSel}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Corte</SelectLabel>
                  {BREEDS_CORTE.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Leite / Dupla Aptidão</SelectLabel>
                  {BREEDS_LEITE.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectItem value="Outra">Outra (Digitar…)</SelectItem>
              </SelectContent>
            </Select>
            {breedSel === "Outra" && (
              <Input
                placeholder="Digite a raça"
                value={breedOther}
                onChange={(e) => setBreedOther(e.target.value)}
                className="h-11"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="h-11" />
          </div>

          {(["conv", "macho", "femea"] as const).map((key) => {
            const slot = key === "conv" ? conv : key === "macho" ? macho : femea;
            const setSlot = key === "conv" ? setConv : key === "macho" ? setMacho : setFemea;
            const title = key === "conv" ? "Convencional" : key === "macho" ? "Sexado ♂ (Macho)" : "Sexado ♀ (Fêmea)";
            return (
              <div key={key} className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-semibold">{title}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade</Label>
                    <Input inputMode="numeric" value={slot.qty}
                      onChange={(e) => setSlot({ ...slot, qty: e.target.value.replace(/\D/g, "") })}
                      className="h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input inputMode="decimal" value={slot.price}
                      onChange={(e) => setSlot({ ...slot, price: e.target.value })}
                      className="h-11" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Código/Registro da Palheta</Label>
                  <Input value={slot.code}
                    onChange={(e) => setSlot({ ...slot, code: e.target.value })} className="h-11" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Caneca</Label>
                    <Input value={slot.canister}
                      onChange={(e) => setSlot({ ...slot, canister: e.target.value })}
                      placeholder="Ex: 01" className="h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Botijão</Label>
                    <Input value={slot.botijao}
                      onChange={(e) => setSlot({ ...slot, botijao: e.target.value })}
                      placeholder="Ex: A1" className="h-11" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir touro
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir este touro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O histórico de inseminações já registrado será mantido.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
