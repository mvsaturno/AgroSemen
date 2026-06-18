import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useInseminations, useClients, useSettings, useDeleteInsemination, type Insemination } from "@/lib/data";
import { EditInseminationDialog } from "@/components/EditInseminationDialog";

export const Route = createFileRoute("/history")({ component: History });

type Period = "week" | "month" | "year" | "custom";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function rangeOf(p: Period, customMonth: number, customYear: number): { start: Date; end: Date } {
  const start = new Date();
  const end = new Date(8640000000000000); // far future by default
  if (p === "week") start.setDate(start.getDate() - start.getDay());
  else if (p === "month") start.setDate(1);
  else if (p === "year") start.setMonth(0, 1);
  else {
    start.setFullYear(customYear, customMonth, 1);
    const e = new Date(customYear, customMonth + 1, 1);
    e.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    return { start, end: e };
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function History() {
  const { data: ins = [] } = useInseminations();
  const { data: clients = [] } = useClients();
  const { data: settings } = useSettings();
  const isCommercial = settings?.profile === "comercial";
  const now = new Date();
  const [period, setPeriod] = useState<Period>("month");
  const [customMonth, setCustomMonth] = useState<number>(now.getMonth());
  const [customYear, setCustomYear] = useState<number>(now.getFullYear());
  const { start, end } = useMemo(
    () => rangeOf(period, customMonth, customYear),
    [period, customMonth, customYear]
  );
  const list = useMemo(
    () => ins.filter((i) => {
      const d = new Date(i.date);
      return d >= start && d < end;
    }),
    [ins, start, end]
  );
  const revenue = list.reduce((s, i) => s + i.price, 0);

  // Por cliente
  const [clientFilter, setClientFilter] = useState<string>("");
  const [sort, setSort] = useState<"top" | "date">(isCommercial ? "top" : "date");

  const clientStats = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; last: string }>();
    ins.forEach((i) => {
      const key = i.clientId ?? `name:${i.client}`;
      const cur = map.get(key) ?? { name: i.client, total: 0, count: 0, last: i.date };
      cur.total += i.price;
      cur.count += 1;
      if (new Date(i.date) > new Date(cur.last)) cur.last = i.date;
      map.set(key, cur);
    });
    const arr = Array.from(map.entries()).map(([k, v]) => ({ key: k, ...v }));
    arr.sort((a, b) => sort === "top" ? b.total - a.total : +new Date(b.last) - +new Date(a.last));
    return arr;
  }, [ins, sort]);

  const filteredByClient: Insemination[] = useMemo(() => {
    if (!clientFilter) return [];
    return ins.filter((i) => (i.clientId ?? `name:${i.client}`) === clientFilter);
  }, [ins, clientFilter]);

  const bullStats = useMemo(() => {
    const map = new Map<string, { name: string; count: number; last: string }>();
    ins.forEach((i) => {
      const key = i.bullId ?? `name:${i.bullName}`;
      const cur = map.get(key) ?? { name: i.bullName, count: 0, last: i.date };
      cur.count += 1;
      if (new Date(i.date) > new Date(cur.last)) cur.last = i.date;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [ins]);

  return (
    <AppLayout title="Histórico">
      <Tabs defaultValue="geral">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="cliente">Por Cliente</TabsTrigger>
          <TabsTrigger value="touro">Touro</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-3">
          <div className="mb-3 grid grid-cols-4 gap-2">
            {(["week", "month", "year", "custom"] as Period[]).map((p) => (
              <Button key={p} size="sm" variant={period === p ? "default" : "outline"}
                onClick={() => setPeriod(p)} className="h-10">
                {p === "week" ? "Semana" : p === "month" ? "Mês" : p === "year" ? "Ano" : "Escolher"}
              </Button>
            ))}
          </div>
          {period === "custom" && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Select value={String(customMonth)} onValueChange={(v) => setCustomMonth(Number(v))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((n, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(customYear)} onValueChange={(v) => setCustomYear(Number(v))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((off) => {
                    const y = now.getFullYear() - off;
                    return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={`mb-4 grid gap-3 ${isCommercial ? "grid-cols-2" : "grid-cols-1"}`}>
            <Card className="bg-card p-4">
              <p className="text-xs text-muted-foreground">Aplicações</p>
              <p className="text-3xl font-bold text-primary">{list.length}</p>
            </Card>
            {isCommercial && (
              <Card className="rounded-2xl border-0 bg-primary p-4 text-primary-foreground shadow-sm">
                <p className="text-xs opacity-90">Faturamento</p>
                <p className="text-2xl font-bold">
                  {revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </Card>
            )}
          </div>
          {list.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma inseminação no período.</Card>
          ) : (
            <div className="space-y-2">
              {list.map((i) => <InsItem key={i.id} i={i} showPrice={isCommercial} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cliente" className="mt-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Escolher cliente" /></SelectTrigger>
              <SelectContent>
                {clientStats.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Nenhum cliente</div>
                ) : clientStats.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                    {isCommercial
                      ? ` · ${c.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                      : ` · ${c.count} aplic.`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as "top" | "date")}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {isCommercial && <SelectItem value="top">Quem mais comprou</SelectItem>}
                <SelectItem value="date">Mais recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!clientFilter ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Ranking de clientes:</p>
              {clientStats.map((c) => (
                <Card key={c.key} className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.count} aplicações · última {new Date(c.last).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {isCommercial && (
                    <span className="font-bold text-primary">
                      {c.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  )}
                </Card>
              ))}
            </div>
          ) : filteredByClient.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum registro para esse cliente.</Card>
          ) : (
            <div className="space-y-2">
              {filteredByClient.map((i) => <InsItem key={i.id} i={i} showPrice={isCommercial} />)}
            </div>
          )}

          {clients.length === 0 && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Cadastre clientes em Ajustes › Clientes.
            </p>
          )}
        </TabsContent>

        <TabsContent value="touro" className="mt-3">
          {bullStats.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma inseminação registrada.</Card>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Ranking de touros mais usados:</p>
              {bullStats.map((b, idx) => (
                <Card key={b.key} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      <span className="mr-2 text-muted-foreground">#{idx + 1}</span>
                      {b.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      última {new Date(b.last).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
                    {b.count} aplic.
                  </span>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function InsItem({ i, showPrice = true }: { i: Insemination; showPrice?: boolean }) {
  const del = useDeleteInsemination();
  const [editing, setEditing] = useState<Insemination | null>(null);
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{i.client}</p>
          <p className="truncate text-xs text-muted-foreground">
            Vaca {i.cowId} · Touro {i.bullName} · {
              i.semenType === "sexado_macho" ? "Sexado ♂"
              : i.semenType === "sexado_femea" ? "Sexado ♀"
              : (i.semenType as string) === "sexado" ? "Sexado"
              : "Conv."
            }
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(i.date).toLocaleDateString("pt-BR")} · {i.userName}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showPrice && (
            <span className="font-bold text-primary">
              {i.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(i)}
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir inseminação?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A dose será devolvida ao estoque do touro.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    del.mutate(i.id, {
                      onSuccess: () => toast.success("Inseminação excluída"),
                      onError: (e) => toast.error((e as Error).message),
                    })
                  }
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <EditInseminationDialog ins={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </Card>
  );
}
