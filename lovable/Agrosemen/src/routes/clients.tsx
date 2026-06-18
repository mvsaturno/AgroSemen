import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useClients, useAddClient, useUpdateClient, useDeleteClient, useInseminations, type Client } from "@/lib/data";
import { Pencil, Plus, Trash2, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/clients")({ component: ClientsPage });

function ClientsPage() {
  const { data: clients = [] } = useClients();
  const { data: ins = [] } = useInseminations();
  const add = useAddClient();
  const update = useUpdateClient();
  const del = useDeleteClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  const openNew = () => {
    setEditing(null); setName(""); setPhone(""); setLocation(""); setOpen(true);
  };
  const openEdit = (c: Client) => {
    setEditing(c); setName(c.name); setPhone(c.phone); setLocation(c.location); setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, name, phone, location });
        toast.success("Cliente atualizado");
      } else {
        await add.mutateAsync({ name, phone, location });
        toast.success("Cliente criado");
      }
      setOpen(false);
    } catch (e) { console.error(e); toast.error("Erro ao salvar"); }
  };

  const onDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast.success("Cliente excluído");
    } catch (e) { console.error(e); toast.error("Erro ao excluir"); }
  };

  return (
    <AppLayout title="Clientes">
      <Button onClick={openNew} size="lg" className="mb-3 h-14 w-full text-base">
        <Plus className="mr-2 h-5 w-5" /> Novo cliente
      </Button>

      {clients.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente cadastrado.</Card>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => {
            const history = ins.filter((i) => i.clientId === c.id);
            const total = history.reduce((s, i) => s + i.price, 0);
            return (
              <Card key={c.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    {c.phone && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </p>
                    )}
                    {c.location && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {c.location}
                      </p>
                    )}
                    <p className="mt-1 text-xs">
                      {history.length} aplicações · <b>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b>
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="outline" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir {c.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O histórico de inseminações desse cliente será mantido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(c.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1">
              <Label>Telefone / WhatsApp</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1">
              <Label>Propriedade / Localização</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
