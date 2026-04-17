import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Save, LogOut, Lock, Unlock, Eye, EyeOff } from "lucide-react";

const DEFAULT_ADMIN_PASSWORD = "123456789.a";

export default function Settings() {
  const { isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  const [azureClientId, setAzureClientId] = useState("");

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    setAzureClientId(localStorage.getItem("azureClientId") || "");
    setRepoUrl(localStorage.getItem("githubRepo") || "");
    setToken(localStorage.getItem("githubToken") || "");
    setAdminPassword(localStorage.getItem("adminPassword") || DEFAULT_ADMIN_PASSWORD);
  }, []);

  const handleUnlock = () => {
    const stored = localStorage.getItem("adminPassword") || DEFAULT_ADMIN_PASSWORD;
    if (passwordInput === stored) {
      setAdminUnlocked(true);
      setPasswordError(false);
      setPasswordInput("");
    } else {
      setPasswordError(true);
    }
  };

  const handleSaveBasic = () => {
    localStorage.setItem("azureClientId", azureClientId);
    toast.success("Ajustes guardados");
  };

  const handleSaveAdmin = () => {
    localStorage.setItem("githubRepo", repoUrl);
    localStorage.setItem("githubToken", token);
    localStorage.setItem("adminPassword", adminPassword);
    toast.success("Configuración de admin guardada");
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b border-white/5 bg-card/50 flex items-center px-6 sticky top-0 z-50 gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-gray-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-white">Ajustes</h1>
      </header>

      <main className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-6">

        <Card className="bg-card/50 border-white/5">
          <CardHeader>
            <CardTitle className="text-white">Autenticación Microsoft</CardTitle>
            <CardDescription>
              Client ID de Azure para el inicio de sesión con Microsoft.{" "}
              <a
                href="https://entra.microsoft.com"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline"
              >
                Registrar app en Azure →
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="azureClientId">Azure Client ID</Label>
              <Input
                id="azureClientId"
                value={azureClientId}
                onChange={(e) => setAzureClientId(e.target.value)}
                className="bg-background/50 border-white/10 text-white font-mono"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <Button onClick={handleSaveBasic} className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
              <Save className="mr-2 h-4 w-4" /> Guardar
            </Button>
          </CardContent>
        </Card>

        {!adminUnlocked ? (
          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-400" />
                Configuración de Admin
              </CardTitle>
              <CardDescription>
                Introduce la contraseña de administrador para acceder a la configuración avanzada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminPass">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="adminPass"
                    type={showPassword ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                    className={`bg-background/50 border-white/10 text-white pr-10 ${passwordError ? "border-red-500" : ""}`}
                    placeholder="Contraseña de admin"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-red-400">Contraseña incorrecta</p>
                )}
              </div>
              <Button onClick={handleUnlock} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">
                <Unlock className="mr-2 h-4 w-4" /> Acceder como Admin
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/50 border-amber-500/20 border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Unlock className="h-5 w-5 text-amber-400" />
                  Configuración de Admin
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdminUnlocked(false)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Bloquear
                </Button>
              </div>
              <CardDescription>
                Configuración avanzada del servidor de modpacks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="repo">Repositorio GitHub</Label>
                <Input
                  id="repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="bg-background/50 border-white/10 text-white"
                  placeholder="usuario/modpacks-repo"
                />
                <p className="text-xs text-muted-foreground">
                  URL del repositorio donde están los modpacks (ej: tomaamns-glitch/NewALaunchi)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="token">Token GitHub</Label>
                <Input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="bg-background/50 border-white/10 text-white"
                  placeholder="ghp_..."
                />
                <p className="text-xs text-muted-foreground">
                  Token con permisos de escritura para publicar modpacks desde el panel de admin.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newAdminPass">Cambiar contraseña de Admin</Label>
                <Input
                  id="newAdminPass"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="bg-background/50 border-white/10 text-white"
                />
              </div>

              <Button onClick={handleSaveAdmin} className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold w-full">
                <Save className="mr-2 h-4 w-4" /> Guardar configuración de Admin
              </Button>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && (
          <div className="pt-2">
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
            >
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        )}

      </main>
    </div>
  );
}
