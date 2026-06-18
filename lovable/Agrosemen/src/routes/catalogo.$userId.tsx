import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicCatalog, type PublicBull, type PublicCatalog } from "@/lib/catalog.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/catalogo/$userId")({
  loader: async ({ params }) => {
    const catalog = await getPublicCatalog({ data: { userId: params.userId } });
    if (!catalog) throw notFound();
    return catalog;
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.farmName} — Catálogo de Touros`
      : "Catálogo de Touros";
    const description = loaderData
      ? `Veja os touros disponíveis em ${loaderData.farmName} e escolha o seu pelo WhatsApp.`
      : "Catálogo de touros disponíveis.";
    const image = loaderData?.bulls.find((b) => b.photo)?.photo ?? undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(image ? [{ property: "og:image", content: image }] : []),
      ],
    };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-md p-6 text-center text-sm text-muted-foreground">
      Catálogo indisponível no momento.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-6 text-center text-sm text-muted-foreground">
      Catálogo não encontrado ou ainda não configurado.
    </div>
  ),
  component: CatalogPage,
});

function CatalogPage() {
  const catalog = Route.useLoaderData() as PublicCatalog;
  const grouped = useMemo(() => {
    const map = new Map<string, PublicBull[]>();
    catalog.bulls.forEach((b) => {
      const k = b.breed || "Sem raça";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    });
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [catalog.bulls]);

  const choose = (b: PublicBull) => {
    const msg = `Olá! Gostaria de reservar o touro ${b.name} (${b.breed}${b.code ? ` - código ${b.code}` : ""}).`;
    const url = `https://wa.me/${catalog.whatsapp}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Catálogo de Touros
          </p>
          <h1 className="text-xl font-bold">{catalog.farmName}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Toque em <b>Escolher</b> para enviar uma mensagem pelo WhatsApp.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-4">
        {catalog.bulls.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum touro disponível no momento.
          </Card>
        ) : (
          grouped.map(([breed, items]) => (
            <section key={breed}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
                  {breed}
                </h2>
                <span className="text-xs text-muted-foreground">
                  ({items.length})
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((b) => (
                  <BullCard key={b.id} bull={b} onChoose={() => choose(b)} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

function BullCard({ bull, onChoose }: { bull: PublicBull; onChoose: () => void }) {
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <Card className="overflow-hidden p-2">
        {bull.photo ? (
          <img
            src={bull.photo}
            alt={bull.name}
            onClick={() => setZoom(true)}
            className="aspect-square w-full cursor-zoom-in rounded-md object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
            sem foto
          </div>
        )}
        <div className="mt-2 min-w-0">
          <p className="truncate text-sm font-semibold">{bull.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {bull.breed}
            {bull.code ? ` · ${bull.code}` : ""}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {bull.quantity > 0 && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
              Convencional
            </span>
          )}
          {bull.quantitySexado > 0 && (
            <span className="rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">
              Sexado
            </span>
          )}
        </div>
        <Button
          onClick={onChoose}
          className="mt-2 h-9 w-full bg-blue-600 text-white hover:bg-blue-700"
        >
          Escolher
        </Button>
      </Card>
      {zoom && bull.photo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(false)}
        >
          <img
            src={bull.photo}
            alt={bull.name}
            className="max-h-[90vh] max-w-full rounded-md object-contain"
          />
        </div>
      )}
    </>
  );
}