import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Save, LogOut } from "lucide-react";

export default function Settings() {
  const { isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    setRepoUrl(localStorage.getItem("githubRepo") || "");
    setToken(localStorage.getItem("githubToken") || "");
    setAdminPassword(localStorage.getItem("adminPassword") || "admin123");
  }, []);

  const handleSave = () => {
    localStorage.setItem("githubRepo", repoUrl);
    localStorage.setItem("githubToken", token);
    localStorage.setItem("adminPassword", adminPassword);
    toast.success("Ajustes guardados correctamente");
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

      <main className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-8">
        
        <Card className="bg-card/50 border-white/5">
          <CardHeader>
            <CardTitle className="text-white">Integración con GitHub</CardTitle>
            <CardDescription>
              Configura el repositorio desde donde ALaunchi descargará los modpacks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo">Repositorio GitHub (URL o usuario/repo)</Label>
              <Input 
                id="repo" 
                value={repoUrl} 
                onChange={(e) => setRepoUrl(e.target.value)} 
                className="bg-background/50 border-white/10 text-white"
                placeholder="ej: usuario/modpacks-repo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">Token GitHub (Opcional, para admin)</Label>
              <Input 
                id="token" 
                type="password"
                value={token} 
                onChange={(e) => setToken(e.target.value)} 
                className="bg-background/50 border-white/10 text-white"
                placeholder="ghp_..."
              />
              <p className="text-xs text-muted-foreground">
                Solo necesario si vas a publicar actualizaciones desde el panel de administración.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/5">
          <CardHeader>
            <CardTitle className="text-white">Seguridad</CardTitle>
            <CardDescription>
              Protege el acceso al panel de administración.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="adminPass">Contraseña Admin</Label>
              <Input 
                id="adminPass" 
                type="password"
                value={adminPassword} 
                onChange={(e) => setAdminPassword(e.target.value)} 
                className="bg-background/50 border-white/10 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center pt-4">
          <Button variant="destructive" onClick={handleLogout} className="bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
          
          <Button onClick={handleSave} className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-8">
            <Save className="mr-2 h-4 w-4" /> Guardar Ajustes
          </Button>
        </div>

      </main>
    </div>
  );
}
