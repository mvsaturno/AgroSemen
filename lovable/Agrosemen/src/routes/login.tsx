import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { signIn, useSession } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Syringe } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [contact, setContact] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Se já existe sessão em cache (mesmo offline), entra direto.
  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return toast.error("PIN deve ter 4 dígitos");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return toast.error("Sem internet — não é possível fazer o primeiro login offline");
    }
    setSubmitting(true);
    try {
      await signIn(contact, pin);
      toast.success("Bem-vindo!");
      navigate({ to: "/" });
    } catch (err) {
      console.error(err);
      toast.error("Contato ou PIN inválido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-full bg-primary p-3 text-primary-foreground">
            <Syringe className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">AgroSêmen</h1>
          <p className="text-sm text-muted-foreground">Controle de estoque e serviços</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact">E-mail ou Telefone</Label>
            <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} className="h-12 text-base" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">PIN (4 dígitos)</Label>
            <Input id="pin" inputMode="numeric" maxLength={4} value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="h-12 text-center text-2xl tracking-[0.5em]" required />
          </div>
          <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full text-base">
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button asChild variant="outline" size="lg" className="mt-4 h-12 w-full text-base">
          <Link to="/register">Criar nova conta</Link>
        </Button>
      </Card>
    </div>
  );
}