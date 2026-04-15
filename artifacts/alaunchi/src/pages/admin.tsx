import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useModpacks } from "@/hooks/use-modpacks";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Plus, Edit, Trash, Upload, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { publishUpdate, fetchModpackFiles, ModFile } from "@/services/github";

export default function Admin() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { modpacks, loadModpacks } = useModpacks();
  
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  
  const [selectedModpack, setSelectedModpack] = useState("");
  const [files, setFiles] = useState<ModFile[]>([]);
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());
  const [filesToAdd, setFilesToAdd] = useState<File[]>([]);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    if (authenticated && modpacks.length === 0) {
      loadModpacks();
    }
  }, [authenticated, modpacks.length, loadModpacks]);

  useEffect(() => {
    if (selectedModpack) {
      const repoUrl = localStorage.getItem("githubRepo") || "";
      fetchModpackFiles(repoUrl, selectedModpack).then(f => setFiles(f));
    } else {
      setFiles([]);
    }
    setSelectedToDelete(new Set());
    setFilesToAdd([]);
  }, [selectedModpack]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = localStorage.getItem("adminPassword") || "admin123";
    if (password === stored) {
      setAuthenticated(true);
    } else {
      toast.error("Contraseña incorrecta");
    }
  };

  const handlePublish = async () => {
    if (!selectedModpack) return;
    const token = localStorage.getItem("githubToken") || "";
    const repoUrl = localStorage.getItem("githubRepo") || "";
    
    try {
      await publishUpdate(token, repoUrl, selectedModpack, Array.from(selectedToDelete), filesToAdd);
      toast.success("Actualización publicada correctamente");
      setSelectedModpack("");
    } catch (e) {
      toast.error("Error al publicar");
    }
  };

  const toggleDelete = (filename: string) => {
    const next = new Set(selectedToDelete);
    if (next.has(filename)) next.delete(filename);
    else next.add(filename);
    setSelectedToDelete(next);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Button variant="ghost" onClick={() => setLocation("/")} className="absolute top-4 left-4 text-gray-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-card border border-white/5 p-8 rounded-xl shadow-2xl"
        >
          <div className="flex flex-col items-center mb-6">
            <div className="h-12 w-12 bg-accent/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center">Acceso Admin</h2>
            <p className="text-muted-foreground text-sm text-center mt-1">
              Introduce la contraseña de administrador para continuar.
            </p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="bg-background/50 border-white/10 text-white"
                placeholder="admin123"
              />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
              Entrar
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b border-white/5 bg-card/50 flex items-center px-6 sticky top-0 z-50 gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-gray-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-white">Panel de Administración</h1>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <Tabs defaultValue="modpacks" className="w-full">
          <TabsList className="bg-card border border-white/5 mb-8">
            <TabsTrigger value="modpacks" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Modpacks</TabsTrigger>
            <TabsTrigger value="update" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Nueva Versión</TabsTrigger>
          </TabsList>
          
          <TabsContent value="modpacks">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Gestión de Modpacks</h2>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="mr-2 h-4 w-4" /> Nuevo Modpack
              </Button>
            </div>
            
            <div className="grid gap-4">
              {modpacks.map(pack => (
                <Card key={pack.id} className="bg-card/50 border-white/5">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <img src={pack.imageUrl} alt={pack.name} className="h-16 w-16 object-cover rounded bg-black" />
                      <div>
                        <h3 className="font-bold text-white">{pack.name}</h3>
                        <p className="text-sm text-muted-foreground">{pack.minecraftVersion} • {pack.loaderType}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-destructive hover:bg-destructive/10">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="update">
            <Card className="bg-card/50 border-white/5">
              <CardHeader>
                <CardTitle className="text-white">Publicar Nueva Versión</CardTitle>
                <CardDescription>
                  Sube nuevos mods y elimina los antiguos para actualizar un modpack.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-gray-200">Seleccionar Modpack</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedModpack}
                    onChange={(e) => setSelectedModpack(e.target.value)}
                  >
                    <option value="">Selecciona un modpack...</option>
                    {modpacks.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {selectedModpack && (
                  <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                    <div className="space-y-4">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <Trash className="h-4 w-4 text-destructive" /> Archivos a eliminar
                      </h4>
                      <div className="bg-background/50 border border-white/5 rounded-md p-4 space-y-3 max-h-[300px] overflow-y-auto">
                        {files.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No hay archivos.</p>
                        ) : (
                          files.map(f => (
                            <div key={f.filename} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`del-${f.filename}`} 
                                checked={selectedToDelete.has(f.filename)}
                                onCheckedChange={() => toggleDelete(f.filename)}
                                className="border-white/20 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                              />
                              <Label 
                                htmlFor={`del-${f.filename}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-300 cursor-pointer"
                              >
                                {f.filename}
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <Upload className="h-4 w-4 text-accent" /> Archivos nuevos
                      </h4>
                      <div className="bg-background/50 border border-white/5 border-dashed rounded-md p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/5 transition-colors">
                        <Upload className="h-8 w-8 text-muted-foreground mb-4" />
                        <p className="text-sm font-medium text-gray-200">Haz clic o arrastra archivos aquí</p>
                        <p className="text-xs text-muted-foreground mt-1">.jar, .zip</p>
                        <input 
                          type="file" 
                          multiple 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files) {
                              setFilesToAdd(Array.from(e.target.files));
                            }
                          }}
                          id="file-upload"
                        />
                        <Label htmlFor="file-upload" className="absolute inset-0 cursor-pointer"></Label>
                      </div>
                      {filesToAdd.length > 0 && (
                        <div className="text-sm text-gray-300">
                          {filesToAdd.length} archivos seleccionados.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-6 flex justify-end">
                  <Button 
                    onClick={handlePublish} 
                    disabled={!selectedModpack || (selectedToDelete.size === 0 && filesToAdd.length === 0)}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-8"
                  >
                    Publicar Versión
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
