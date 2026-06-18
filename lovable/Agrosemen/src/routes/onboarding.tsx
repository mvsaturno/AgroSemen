import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession, useSettings, useSetProfile, type AppProfile } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { data: settings, isLoading: sLoading } = useSettings();
  const setProfile = useSetProfile();
  const [choice, setChoice] = useState<AppProfile | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!sLoading && settings?.profile) navigate({ to: "/" });
  }, [sLoading, settings?.profile, navigate]);

  const save = async () => {
    if (!choice) return toast.error("Escolha um perfil");
    try {
      await setProfile.mutateAsync(choice);
      toast.success("Perfil salvo!");
      navigate({ to: "/" });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    }
  };

  if (loading || sLoading || !user) return null;

  const options: { id: AppProfile; emoji: string; title: string; desc: string }[] = [
    { id: "comercial", emoji: "💼", title: "Prestador de Serviços", desc: "Uso comercial — registro de valores e clientes" },
    { id: "proprio", emoji: "🚜", title: "Uso Próprio", desc: "Produtor rural — sem cobrança de serviço" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-bold">Como você vai usar o AgroSêmen?</h1>
        <p className="mb-6 text-sm text-muted-foreground">Escolha o perfil que melhor descreve você. Pode alterar depois nos Ajustes.</p>
        <div className="space-y-3">
          {options.map((o) => {
            const active = choice === o.id;
            return (
              <Card
                key={o.id}
                onClick={() => setChoice(o.id)}
                className={`cursor-pointer p-5 transition ${active ? "border-primary ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{o.emoji}</span>
                  <div>
                    <p className="text-lg font-semibold">{o.title}</p>
                    <p className="text-sm text-muted-foreground">{o.desc}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <Button
          size="lg"
          className="mt-6 h-14 w-full text-base"
          disabled={!choice || setProfile.isPending}
          onClick={save}
        >
          {setProfile.isPending ? "Salvando..." : "Avançar"}
        </Button>
      </div>
    </div>
  );
}