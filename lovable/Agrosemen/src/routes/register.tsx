import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { signUp } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({ component: Register });

function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedContact = contact.trim();
    if (!trimmedName) return toast.error("Informe seu nome");
    if (!trimmedContact) return toast.error("Informe e-mail ou telefone");
    if (pin.length !== 4) return toast.error("PIN deve ter 4 dígitos");
    setLoading(true);
    try {
      await signUp(trimmedName, trimmedContact, pin);
      toast.success("Cadastro realizado!");
      navigate({ to: "/onboarding" });
    } catch (err: unknown) {
      console.error("register error", err);
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar";
      toast.error(msg.includes("already") ? "Já existe conta com esse contato" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-2xl font-bold">Criar conta</h1>
        <p className="mb-6 text-sm text-muted-foreground">É rápido. Use um PIN fácil de lembrar.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" required />
          </div>
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
          <Button type="submit" size="lg" disabled={loading} className="h-12 w-full text-base">
            {loading ? "Criando..." : "Cadastrar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          Já tem conta? <Link to="/login" className="font-medium text-primary underline">Entrar</Link>
        </p>
      </Card>
    </div>
  );
}