import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { loginWithMicrosoft, isElectron, AuthStep } from "@/services/auth";
import { Loader2, CheckCircle2, Copy, ExternalLink, AlertCircle } from "lucide-react";

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      data-testid="button-copy-code"
      className="group flex items-center gap-3 bg-black/40 border border-white/10 hover:border-accent/50 rounded-xl px-6 py-4 transition-all w-full justify-center"
    >
      <span className="font-mono text-3xl font-bold tracking-[0.3em] text-white">{code}</span>
      <span className="text-muted-foreground group-hover:text-accent transition-colors">
        {copied ? <CheckCircle2 className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
      </span>
    </button>
  );
}

type StepState =
  | "idle"
  | "requesting_code"
  | "awaiting_user"
  | "polling"
  | "authenticating"
  | "done"
  | "error";

export default function Login() {
  const { isAuthenticated, setAuth, loadPersistedAuth } = useAuth();
  const [, setLocation] = useLocation();
  const [stepState, setStepState] = useState<StepState>("idle");
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadPersistedAuth();
  }, [loadPersistedAuth]);

  useEffect(() => {
    if (isAuthenticated) setLocation("/");
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleProgress = useCallback((step: AuthStep) => {
    setStepState(step.stage as StepState);
    if (step.stage === "awaiting_user") {
      setUserCode(step.userCode);
      setVerificationUri(step.verificationUri);
      setCountdown(step.expiresIn);
    }
    if (step.stage === "error") setErrorMsg(step.message);
  }, []);

  const handleMicrosoftLogin = async () => {
    if (!isElectron) {
      const mockData = {
        mcToken: "mock_token",
        username: "Steve",
        uuid: "00000000-0000-0000-0000-000000000000",
        expiresAt: Date.now() + 86_400_000,
      };
      await setAuth(mockData);
      return;
    }

    setErrorMsg("");
    setStepState("requesting_code");

    try {
      const authData = await loginWithMicrosoft(handleProgress);
      await setAuth(authData);
    } catch (e: any) {
      setStepState("error");
      setErrorMsg(e.message ?? "Error desconocido. Inténtalo de nuevo.");
    }
  };

  const reset = () => {
    setStepState("idle");
    setErrorMsg("");
    setUserCode("");
    setCountdown(0);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/10 via-background to-background z-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 flex flex-col items-center max-w-sm w-full p-8 border border-white/5 bg-card/80 backdrop-blur-md rounded-2xl shadow-2xl"
      >
        <img
          src="/logo.png"
          alt="ALaunchi"
          className="h-16 mb-6 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
            sibling?.classList.remove("hidden");
          }}
        />
        <div className="hidden mb-6 text-4xl font-bold tracking-tighter text-white">
          <span className="bg-accent text-accent-foreground px-2 py-1 rounded">AL</span>aunchi
        </div>

        <AnimatePresence mode="wait">

          {stepState === "idle" && (
            <motion.div key="idle" className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button
                size="lg"
                data-testid="button-microsoft-login"
                className="w-full bg-white text-black hover:bg-gray-100 transition-colors h-14 text-base font-semibold"
                onClick={handleMicrosoftLogin}
              >
                <MicrosoftIcon className="mr-2 h-5 w-5" />
                Iniciar sesión con Microsoft
              </Button>
              {!isElectron && (
                <p className="text-xs text-center text-amber-400/80 border border-amber-400/20 bg-amber-400/5 rounded-lg px-3 py-2">
                  Vista previa: el login completo de Microsoft requiere la app de escritorio instalada.
                </p>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Necesitas una cuenta de Minecraft comprada para usar ALaunchi.
              </p>
            </motion.div>
          )}

          {stepState === "requesting_code" && (
            <motion.div key="requesting" className="w-full flex flex-col items-center gap-3 py-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Conectando con Microsoft...</p>
            </motion.div>
          )}

          {(stepState === "awaiting_user" || stepState === "polling") && (
            <motion.div key="awaiting" className="w-full space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-white">Abre tu navegador e introduce este código</p>
                <p className="text-xs text-muted-foreground">El navegador se ha abierto automáticamente</p>
              </div>

              <CodeBox code={userCode} />

              <a
                href={verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-verification"
                className="flex items-center justify-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {verificationUri}
              </a>

              <div className="flex items-center justify-between text-xs text-muted-foreground border border-white/5 rounded-lg px-4 py-2.5 bg-black/20">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  Esperando autorización...
                </span>
                {countdown > 0 && (
                  <span className={countdown < 60 ? "text-red-400" : "text-muted-foreground"}>
                    {formatCountdown(countdown)}
                  </span>
                )}
              </div>

              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-white" onClick={reset}>
                Cancelar
              </Button>
            </motion.div>
          )}

          {stepState === "authenticating" && (
            <motion.div key="authenticating" className="w-full flex flex-col items-center gap-3 py-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Iniciando sesión...</p>
                <p className="text-xs text-muted-foreground mt-1">Verificando cuenta de Minecraft</p>
              </div>
            </motion.div>
          )}

          {stepState === "done" && (
            <motion.div key="done" className="w-full flex flex-col items-center gap-3 py-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CheckCircle2 className="h-10 w-10 text-green-400" />
              <p className="text-sm font-medium text-white">Sesión iniciada correctamente</p>
              <p className="text-xs text-muted-foreground">Redirigiendo...</p>
            </motion.div>
          )}

          {stepState === "error" && (
            <motion.div key="error" className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-start gap-3 border border-red-500/20 bg-red-500/5 rounded-lg px-4 py-3">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Error de autenticación</p>
                  <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full bg-white text-black hover:bg-gray-100 h-12 font-semibold"
                onClick={reset}
              >
                Intentar de nuevo
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
