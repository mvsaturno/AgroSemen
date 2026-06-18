import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useSession, useSettings, useSetMinStock, useSetProfile, useSetDefaultPrices,
  useBulls, useRestoreBackup, useSetWhatsApp, signOutUser, type AppProfile,
} from "@/lib/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Users, Download, Share2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: settings } = useSettings();
  const { data: bulls = [] } = useBulls();
  const setMin = useSetMinStock();
  const setProfile = useSetProfile();
  const setDefaultPrices = useSetDefaultPrices();
  const setWhatsApp = useSetWhatsApp();
  const restoreBackup = useRestoreBackup();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<{
    payload: Record<string, unknown>;
    counts: { bulls: number; inseminations: number; movements: number; clients: number };
  } | null>(null);

  const [defConv, setDefConv] = useState<string>("");
  const [defSex, setDefSex] = useState<string>("");
  const [wpp, setWpp] = useState<string>("");
  const convValue = defConv !== "" ? defConv : String(settings?.defaultPriceConvencional ?? 0).replace(".", ",");
  const sexValue = defSex !== "" ? defSex : String(settings?.defaultPriceSexado ?? 0).replace(".", ",");
  const wppValue = wpp !== "" ? wpp : (settings?.whatsappNumber ?? "");

  const isCommercial = settings?.profile === "comercial";

  const logout = async () => {
    await signOutUser();
    toast.success("Sessão encerrada");
    navigate({ to: "/login" });
  };

  const generateBackup = async () => {
    try {
      const [b, i, m, c, s] = await Promise.all([
        supabase.from("bulls").select("*"),
        supabase.from("inseminations").select("*"),
        supabase.from("stock_movements").select("*"),
        supabase.from("clients").select("*"),
        supabase.from("user_settings").select("*"),
      ]);
      const payload = {
        exportedAt: new Date().toISOString(),
        user: { id: user?.id, name: user?.name, contact: user?.contact },
        bulls: b.data ?? [], inseminations: i.data ?? [],
        movements: m.data ?? [], clients: c.data ?? [], settings: s.data ?? [],
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `agrosemen-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([json], { type: "application/json" });

      // 1. Baixa automaticamente
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // 2. Tenta abrir tela nativa de compartilhamento com o arquivo
      try {
        const file = new File([blob], filename, { type: "application/json" });
        const nav = navigator as Navigator & {
          canShare?: (data: { files?: File[] }) => boolean;
          share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
        };
        if (nav.share && nav.canShare?.({ files: [file] })) {
          await nav.share({
            files: [file],
            title: "Backup Agrosêmen",
            text: `Backup gerado em ${new Date().toLocaleDateString("pt-BR")}`,
          });
          toast.success("Backup salvo em Downloads e compartilhado");
        } else {
          toast.success("Backup salvo em Downloads (compartilhamento não suportado neste aparelho)");
        }
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") {
          toast.success("Backup salvo em Downloads");
        } else {
          console.error(err);
          toast.success("Backup salvo em Downloads");
        }
      }
    } catch (e) { console.error(e); toast.error("Erro ao gerar backup"); }
  };

  const shareWhatsApp = () => {
    const date = new Date().toLocaleDateString("pt-BR");
    const lines = bulls.map((b) =>
      `• ${b.name} (${b.breed}) — Convencional: ${b.quantity} | Sexado: ${b.quantitySexado}`,
    );
    const text =
      `📋 *Estoque Agrosêmen — ${date}*\n` +
      (lines.length ? lines.join("\n") : "Sem touros cadastrados.") +
      `\n\nTotal de palhetas: ${bulls.reduce((s, x) => s + x.quantity + x.quantitySexado, 0)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const onPickBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Arquivo inválido");
        }
        const counts = {
          bulls: Array.isArray(parsed.bulls) ? parsed.bulls.length : 0,
          inseminations: Array.isArray(parsed.inseminations) ? parsed.inseminations.length : 0,
          movements: Array.isArray(parsed.movements) ? parsed.movements.length : 0,
          clients: Array.isArray(parsed.clients) ? parsed.clients.length : 0,
        };
        if (counts.bulls + counts.inseminations + counts.movements + counts.clients === 0) {
          throw new Error("Backup vazio ou em formato não reconhecido");
        }
        setPendingBackup({ payload: parsed, counts });
      } catch (err) {
        toast.error((err as Error).message || "Não foi possível ler o arquivo");
      }
    };
    reader.onerror = () => toast.error("Falha ao ler o arquivo");
    reader.readAsText(file);
  };

  const confirmRestore = () => {
    if (!pendingBackup) return;
    restoreBackup.mutate(pendingBackup.payload, {
      onSuccess: (res) => {
        toast.success(
          `Backup restaurado: ${res.bulls} touros, ${res.inseminations} inseminações, ${res.clients} clientes`,
        );
        setPendingBackup(null);
      },
      onError: (e) => {
        toast.error((e as Error).message || "Erro ao restaurar backup");
        setPendingBackup(null);
      },
    });
  };

  return (
    <AppLayout title="Configurações">
      <Card className="mb-4 p-4">
        <p className="text-xs text-muted-foreground">Usuário</p>
        <p className="text-lg font-semibold">{user?.name}</p>
        <p className="text-sm text-muted-foreground">{user?.contact}</p>
      </Card>

      <Card className="mb-4 p-4">
        <Label>Perfil do Aplicativo</Label>
        <Select
          value={settings?.profile ?? ""}
          onValueChange={(v) =>
            setProfile.mutate(v as AppProfile, {
              onSuccess: () =>
                toast.success(
                  v === "proprio"
                    ? "Perfil: Uso Próprio (valores ocultos)"
                    : "Perfil: Prestador de Serviços",
                ),
              onError: (e) => toast.error((e as Error).message),
            })
          }
        >
          <SelectTrigger className="mt-2 h-12 text-base">
            <SelectValue placeholder="Selecionar perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="proprio">🚜 Uso Próprio (Produtor Rural)</SelectItem>
            <SelectItem value="comercial">💼 Prestador de Serviços (Comercial)</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs text-muted-foreground">
          <b>Uso Próprio:</b> oculta valores em todo o app (Histórico, faturamento, ranking).
          <br />
          <b>Prestador de Serviços:</b> habilita campo de valor e relatórios financeiros.
        </p>
      </Card>

      <Card className="mb-4 p-4">
        <Label htmlFor="min">Estoque Mínimo Geral (palhetas)</Label>
        <Input
          id="min"
          inputMode="numeric"
          value={String(settings?.minStock ?? 3)}
          onChange={(e) =>
            setMin.mutate(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))
          }
          className="mt-2 h-12 text-base"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Touros com saldo (Convencional + Sexado) ≤ este valor entram na Lista de Compras.
        </p>
      </Card>

      {isCommercial && (
        <Card className="mb-4 p-4">
          <Label>Valor padrão da inseminação (R$)</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="defconv" className="text-xs text-muted-foreground">Convencional</Label>
              <Input
                id="defconv"
                inputMode="decimal"
                value={convValue}
                onChange={(e) => setDefConv(e.target.value)}
                className="h-12 text-base"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="defsex" className="text-xs text-muted-foreground">Sexado</Label>
              <Input
                id="defsex"
                inputMode="decimal"
                value={sexValue}
                onChange={(e) => setDefSex(e.target.value)}
                className="h-12 text-base"
                placeholder="0,00"
              />
            </div>
          </div>
          <Button
            onClick={() => {
              const c = parseFloat(convValue.replace(",", ".")) || 0;
              const s = parseFloat(sexValue.replace(",", ".")) || 0;
              setDefaultPrices.mutate({ convencional: c, sexado: s });
              toast.success("Valores padrão salvos");
            }}
            className="mt-3 h-12 w-full"
          >Salvar</Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Esses valores serão sugeridos automaticamente conforme o tipo de sêmen escolhido em cada nova inseminação, e podem ser alterados na hora.
          </p>
        </Card>
      )}

      <Card className="mb-4 p-4">
        <Label>Clientes</Label>
        <Button
          variant="outline"
          className="mt-2 h-12 w-full justify-start"
          onClick={() => navigate({ to: "/clients" })}
        >
          <Users className="mr-2 h-5 w-5" /> Gerenciar clientes
        </Button>
      </Card>

      <Card className="mb-4 p-4">
        <Label htmlFor="wpp">WhatsApp para receber pedidos do catálogo</Label>
        <Input
          id="wpp"
          inputMode="tel"
          placeholder="Ex.: 5511999999999 (DDI + DDD + número)"
          value={wppValue}
          onChange={(e) => setWpp(e.target.value.replace(/\D/g, ""))}
          className="mt-2 h-12 text-base"
        />
        <Button
          onClick={() => {
            const clean = wppValue.replace(/\D/g, "");
            if (clean.length < 10) {
              toast.error("Informe o número com DDI + DDD (ex.: 5511999999999)");
              return;
            }
            setWhatsApp.mutate(clean, {
              onSuccess: () => toast.success("WhatsApp salvo"),
              onError: (e) => toast.error((e as Error).message),
            });
          }}
          className="mt-3 h-12 w-full"
        >Salvar WhatsApp</Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Esse número recebe as mensagens dos clientes que escolherem um touro no link público de catálogo (botão Compartilhar na tela de Estoque).
        </p>
      </Card>

      <Card className="mb-4 p-4">
        <Label>Backup e compartilhamento</Label>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          Seus dados já são sincronizados na nuvem automaticamente. O backup gera um arquivo local extra.
        </p>
        <div className="grid gap-2">
          <Button variant="outline" className="h-12 justify-start" onClick={generateBackup}>
            <Download className="mr-2 h-5 w-5" /> Gerar backup (JSON)
          </Button>
          <Button
            variant="outline"
            className="h-12 justify-start"
            onClick={() => fileInputRef.current?.click()}
            disabled={restoreBackup.isPending}
          >
            <Upload className="mr-2 h-5 w-5" />
            {restoreBackup.isPending ? "Restaurando…" : "Restaurar backup (JSON)"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onPickBackupFile}
          />
          <Button variant="outline" className="h-12 justify-start" onClick={shareWhatsApp}>
            <Share2 className="mr-2 h-5 w-5" /> Compartilhar estoque no WhatsApp
          </Button>
        </div>
      </Card>

      <Button variant="destructive" size="lg" className="h-14 w-full text-base" onClick={logout}>
        <LogOut className="mr-2 h-5 w-5" /> Sair da Conta
      </Button>

      <AlertDialog
        open={!!pendingBackup}
        onOpenChange={(o) => { if (!o) setPendingBackup(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <b>apaga tudo</b> que está no app hoje (touros, inseminações,
              movimentações e clientes) e substitui pelos dados do arquivo.
              Não dá para desfazer.
              <br /><br />
              O arquivo contém:
              <br />• {pendingBackup?.counts.bulls ?? 0} touros
              <br />• {pendingBackup?.counts.inseminations ?? 0} inseminações
              <br />• {pendingBackup?.counts.movements ?? 0} movimentações de estoque
              <br />• {pendingBackup?.counts.clients ?? 0} clientes
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreBackup.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestore}
              disabled={restoreBackup.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {restoreBackup.isPending ? "Restaurando…" : "Apagar tudo e restaurar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
