import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useSession, useSettings } from "@/lib/data";

export function AppLayout({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: ReactNode }) {
  const { user, loading } = useSession();
  const { data: settings, isLoading: sLoading } = useSettings();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user && loc.pathname !== "/login" && loc.pathname !== "/register") {
      navigate({ to: "/login" });
      return;
    }
    if (user && !sLoading && settings && !settings.profile && loc.pathname !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [user, loading, sLoading, settings, loc.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }
  if (!user) return null;
  const isHome = loc.pathname === "/";

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-sm rounded-b-3xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">{title ?? "AgroSêmen"}</h1>
            {subtitle && (
              <p className="mt-0.5 text-xs font-medium text-primary-foreground/80">{subtitle}</p>
            )}
          </div>
          <span className="shrink-0 text-xs opacity-90">Olá, {user.name.split(" ")[0]}</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>

      {!isHome && (
        <Link
          to="/"
          aria-label="Voltar para Início"
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95"
        >
          <Home className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
