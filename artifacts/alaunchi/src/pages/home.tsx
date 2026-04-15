import { useAuth } from "@/hooks/use-auth";
import { useModpacks } from "@/hooks/use-modpacks";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, LogOut, Download, Play, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { installModpack, launchMinecraft } from "@/services/electron";
import { toast } from "sonner";
import { Modpack } from "@/services/github";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function ModpackCard({ pack, index }: { pack: Modpack; index: number }) {
  const [status, setStatus] = useState<"idle" | "installing" | "updating" | "launching">("idle");
  const [progress, setProgress] = useState(0);
  const { updateModpackStatus } = useModpacks();

  const handleInstall = async () => {
    setStatus("installing");
    setProgress(0);
    try {
      await installModpack(pack.id, [], (p) => setProgress(p));
      updateModpackStatus(pack.id, { installed: true, installedVersion: pack.version });
      toast.success(`${pack.name} instalado correctamente.`);
    } catch (e) {
      toast.error("Error al instalar.");
    } finally {
      setStatus("idle");
    }
  };

  const handlePlay = async () => {
    try {
      if (pack.updateAvailable) {
        setStatus("updating");
        await installModpack(pack.id, []);
        updateModpackStatus(pack.id, { updateAvailable: false, installedVersion: pack.version });
        toast.success(`${pack.name} actualizado.`);
      }
      setStatus("launching");
      await launchMinecraft(pack.id, pack.minecraftVersion, pack.loaderType);
      toast.success(`Iniciando ${pack.name}...`);
    } catch (e) {
      toast.error("Error al iniciar.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative flex flex-col bg-card rounded-xl overflow-hidden border border-white/5 shadow-lg hover:border-accent/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-accent/5"
    >
      <div className="aspect-[3/4] relative overflow-hidden bg-black/50">
        <img 
          src={pack.imageUrl} 
          alt={pack.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 group-hover:brightness-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent opacity-80" />
        
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="px-2 py-1 text-xs font-bold bg-black/60 backdrop-blur-md rounded border border-white/10 text-white">
            {pack.minecraftVersion}
          </span>
          <span className="px-2 py-1 text-xs font-bold bg-black/60 backdrop-blur-md rounded border border-white/10 text-gray-300 uppercase">
            {pack.loaderType}
          </span>
        </div>
      </div>
      
      <div className="p-5 flex flex-col flex-1 relative z-10 -mt-12">
        <h3 className="text-xl font-bold tracking-tight text-white mb-1 drop-shadow-md">{pack.name}</h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 h-10">{pack.description}</p>
        
        <div className="mt-auto pt-4">
          {status === "installing" ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Instalando...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ) : (
            <Button 
              className={`w-full font-bold h-12 transition-all ${
                pack.installed 
                  ? "bg-accent hover:bg-accent/90 text-accent-foreground shadow-[0_0_15px_rgba(245,166,35,0.3)]" 
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
              onClick={pack.installed ? handlePlay : handleInstall}
              disabled={status !== "idle"}
            >
              {status === "updating" && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {status === "launching" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {status === "idle" && !pack.installed && <Download className="mr-2 h-4 w-4" />}
              {status === "idle" && pack.installed && <Play className="mr-2 h-4 w-4 fill-current" />}
              
              {status === "updating" ? "ACTUALIZANDO..." :
               status === "launching" ? "INICIANDO..." :
               pack.installed ? "JUGAR" : "INSTALAR"}
            </Button>
          )}
          
          {pack.updateAvailable && status === "idle" && (
            <div className="absolute top-4 right-4 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-1 rounded-full animate-pulse shadow-lg">
              UPDATE
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const { isAuthenticated, username, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { modpacks, loadModpacks, loading } = useModpacks();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else {
      loadModpacks();
    }
  }, [isAuthenticated, setLocation, loadModpacks]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b border-white/5 bg-card/50 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="ALaunchi" className="h-8 object-contain" />
          <span className="font-bold tracking-tight hidden">ALaunchi</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-2">
            <Avatar className="h-8 w-8 border border-white/10">
              <AvatarFallback className="bg-accent/20 text-accent font-bold">
                {username?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-gray-200">{username}</span>
          </div>
          
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} className="text-gray-400 hover:text-white">
            <span className="sr-only">Admin</span>
            <div className="text-xs font-mono border border-white/10 px-2 py-1 rounded hover:bg-white/5">ADMIN</div>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} className="text-gray-400 hover:text-white">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} className="text-gray-400 hover:text-white">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {modpacks.map((pack, i) => (
              <ModpackCard key={pack.id} pack={pack} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
