import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBulls, useSettings } from "@/lib/data";
import { Plus, AlertTriangle, Package, Eye, Cylinder, Syringe, History, ShoppingCart, Settings } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { data: bulls = [] } = useBulls();
  const { data: settings } = useSettings();
  const minStock = settings?.minStock ?? 3;
  const total = bulls.reduce((s, b) => s + b.quantity + b.quantitySexado, 0);
  const low = bulls.filter((b) => b.quantity + b.quantitySexado <= minStock);
  const lowCount = low.length;
  const [stockOpen, setStockOpen] = useState(false);

  return (
    <AppLayout title="Início">
      <Card
        onClick={() => setStockOpen(true)}
        className="mb-4 cursor-pointer rounded-3xl border-0 bg-primary p-6 text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Package className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm opacity-90">Estoque atual</p>
            <p className="text-4xl font-bold">{total}</p>
            <p className="text-xs opacity-80">palhetas em {bulls.length} touros · toque para detalhes</p>
          </div>
          <Eye className="h-5 w-5 opacity-80" />
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Card
          onClick={() => navigate({ to: "/insemination" })}
          className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-0 bg-primary p-4 text-center text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Syringe className="h-6 w-6" />
          </div>
          <span className="text-base font-semibold">Inseminar</span>
        </Card>
        <Card
          onClick={() => navigate({ to: "/products" })}
          className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center transition-transform hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
            <Cylinder className="h-6 w-6" />
          </div>
          <span className="text-base font-semibold">Estoque ação rapida</span>
        </Card>
        <Card
          onClick={() => navigate({ to: "/stock-in" })}
          className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center transition-transform hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
            <Plus className="h-6 w-6" />
          </div>
          <span className="text-base font-semibold">Entrada de Estoque</span>
        </Card>
        <Card
          onClick={() => navigate({ to: "/history" })}
          className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center transition-transform hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
            <History className="h-6 w-6" />
          </div>
          <span className="text-base font-semibold">Histórico</span>
        </Card>
        <Card
          onClick={() => navigate({ to: "/shopping" })}
          className="relative flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center transition-transform hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <span className="text-base font-semibold">Compras</span>
          {lowCount > 0 && (
            <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground shadow-[0_4px_12px_-2px_oklch(0.577_0.245_27.325/0.5)]">
              {lowCount}
            </span>
          )}
        </Card>
        <Card
          onClick={() => navigate({ to: "/settings" })}
          className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 text-center transition-transform hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
            <Settings className="h-6 w-6" />
          </div>
          <span className="text-base font-semibold">Ajustes</span>
        </Card>
      </div>

      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Alertas Urgentes
      </h2>
      {low.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum touro abaixo do estoque mínimo.</p>
      ) : (
        <div className="space-y-2">
          {low.map((b) => (
            <Card key={b.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-semibold">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {b.breed} · {b.code}
                </p>
              </div>
              <span className="rounded-full bg-destructive px-3 py-1 text-sm font-bold text-destructive-foreground">
                {b.quantity + b.quantitySexado}
              </span>
            </Card>
          ))}
          <Link to="/shopping" className="block pt-2 text-center text-sm font-medium text-primary underline">
            Ver lista de compras
          </Link>
        </div>
      )}

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estoque atual</DialogTitle>
          </DialogHeader>
          {bulls.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum touro cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {bulls.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.breed} · {b.code}
                    </p>
                  </div>
                  <div className="flex gap-1 text-xs">
                    <span className="rounded bg-primary px-2 py-0.5 font-bold text-primary-foreground">
                      C {b.quantity}
                    </span>
                    <span className="rounded bg-accent px-2 py-0.5 font-bold text-accent-foreground">
                      S {b.quantitySexado}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
