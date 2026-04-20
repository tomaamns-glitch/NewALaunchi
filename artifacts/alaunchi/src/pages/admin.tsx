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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash, Upload, Lock, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { publishUpdate, fetchModpackFiles, createModpack, ModFile, NewModpackData, PendingFile } from "@/services/github";

const LOADERS = ["forge", "fabric", "neoforge", "vanilla"] as const;

const emptyForm = (): NewModpackData => ({
  id: "",
  name: "",
  description: "",
  minecraftVersion: "1.20.4",
  loaderType: "fabric",
  version: "1.0.0",
  imageUrl: "",
});

export default function Admin() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { modpacks, loadModpacks } = useModpacks();

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const [selectedModpack, setSelectedModpack] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [files, setFiles] = useState<ModFile[]>([]);
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());
  const [filesToAdd, setFilesToAdd] = useState<PendingFile[]>([]);
  const [publishing, setPublishing] = useState(false);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newForm, setNewForm] = useState<NewModpackData>(emptyForm());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    if (authenticated && modpacks.length === 0) loadModpacks();
  }, [authenticated]);

  useEffect(() => {
    if (!selectedModpack) { setFiles([]); return; }
    const repoUrl = localStorage.getItem("githubRepo") ?? "";
    fetchModpackFiles(repoUrl, selectedModpack).then(setFiles);
    setSelectedToDelete(new Set());
    setFilesToAdd([] as PendingFile[]);
    const pack = modpacks.find((p) => p.id === selectedModpack);
    if (pack) {
      const [major, minor, patch] = pack.version.split(".").map(Number);
      setNewVersion(`${major}.${minor}.${patch + 1}`);
    }
  }, [selectedModpack]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = localStorage.getItem("adminPassword") ?? "admin123";
    if (password === stored) setAuthenticated(true);
    else toast.error("Contraseña incorrecta");
  };

  const handlePublish = async () => {
    if (!selectedModpack) return;
    const token = localStorage.getItem("githubToken") ?? "";
    const repoUrl = localStorage.getItem("githubRepo") ?? "";
    setPublishing(true);
    try {
      await publishUpdate(token, repoUrl, selectedModpack, Array.from(selectedToDelete), filesToAdd, newVersion || undefined);
      toast.success("Actualización publicada correctamente en GitHub");
      setSelectedModpack("");
      loadModpacks();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al publicar");
    } finally {
      setPublishing(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.id || !newForm.name) { toast.error("ID y nombre son obligatorios"); return; }
    const token = localStorage.getItem("githubToken") ?? "";
    const repoUrl = localStorage.getItem("githubRepo") ?? "";
    setCreating(true);
    try {
      await createModpack(token, repoUrl, newForm);
      toast.success(`Modpack "${newForm.name}" creado en GitHub`);
      setShowNewDialog(false);
      setNewForm(emptyForm());
      loadModpacks();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear modpack");
    } finally {
      setCreating(false);
    }
  };

  const toggleDelete = (filename: string) => {
    const next = new Set(selectedToDelete);
    if (next.has(filename)) next.delete(filename); else next.add(filename);
    setSelectedToDelete(next);
  };

  const FILE_TYPES: ModFile["type"][] = ["mod", "bundle", "resourcepack", "shader", "config"];

  const typeLabel: Record<ModFile["type"], string> = {
    mod: "Mod (.jar)",
    bundle: "Bundle (zip completo)",
    resourcepack: "Resource Pack",
    shader: "Shader",
    config: "Config",
  };

  const guessType = (filename: string): ModFile["type"] => {
    const low = filename.toLowerCase();
    const ext = low.split(".").pop();
    if (ext === "jar") return "mod";
    if (ext === "zip") {
      if (low.includes("shader") || low.includes("shad")) return "shader";
      if (low.includes("resource") || low.includes("texture")) return "resourcepack";
      return "bundle";
    }
    return "config";
  };

  const isBundleFile = (f: ModFile) =>
    f.type === "bundle" || (f.type === "mod" && f.filename.toLowerCase().endsWith(".zip"));

  const addFiles = (newFiles: File[]) => {
    const filtered = newFiles.filter((f) => f.name.endsWith(".jar") || f.name.endsWith(".zip") || f.name.endsWith(".json") || f.name.endsWith(".toml") || f.name.endsWith(".cfg"));
    const pending: PendingFile[] = filtered.map((file) => ({ file, type: guessType(file.name) }));
    setFilesToAdd((prev) => [...prev, ...pending]);
  };

  const updateFileType = (index: number, type: ModFile["type"]) => {
    setFilesToAdd((prev) => prev.map((p, i) => i === index ? { ...p, type } : p));
  };

  const removeFileToadd = (index: number) => {
    setFilesToAdd((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
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
            <h2 className="text-2xl font-bold text-white">Acceso Admin</h2>
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
                autoFocus
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
            <TabsTrigger value="modpacks" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              Modpacks
            </TabsTrigger>
            <TabsTrigger value="update" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              Publicar versión
            </TabsTrigger>
          </TabsList>

          <TabsContent value="modpacks">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Catálogo de Modpacks</h2>
              <Button
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
                onClick={() => setShowNewDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Nuevo Modpack
              </Button>
            </div>

            {modpacks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                <p className="text-base">No hay modpacks en el repositorio.</p>
                <p className="text-sm">Configura tu repositorio en Ajustes y crea el primero.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {modpacks.map((pack) => (
                  <Card key={pack.id} className="bg-card/50 border-white/5">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={pack.imageUrl}
                          alt={pack.name}
                          className="h-14 w-14 object-cover rounded bg-black/50"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
                        />
                        <div>
                          <h3 className="font-bold text-white">{pack.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {pack.minecraftVersion} · {pack.loaderType} · v{pack.version}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono opacity-60">id: {pack.id}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-muted-foreground mr-2">
                          {pack.fileCount} archivos · {pack.totalSizeMb} MB
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="update">
            <Card className="bg-card/50 border-white/5">
              <CardHeader>
                <CardTitle className="text-white">Publicar Nueva Versión</CardTitle>
                <CardDescription>
                  Añade o elimina archivos de un modpack y publica la actualización en GitHub.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-200">Modpack</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
                      value={selectedModpack}
                      onChange={(e) => setSelectedModpack(e.target.value)}
                    >
                      <option value="">Selecciona un modpack...</option>
                      {modpacks.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Nueva versión</Label>
                    <Input
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      className="bg-background/50 border-white/10 text-white"
                      placeholder="ej: 1.2.0"
                    />
                  </div>
                </div>

                {selectedModpack && (
                  <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                    <div className="space-y-4">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <Trash className="h-4 w-4 text-destructive" /> Eliminar archivos
                      </h4>
                      <div className="bg-background/50 border border-white/5 rounded-md p-4 space-y-3 max-h-[280px] overflow-y-auto">
                        {files.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Este modpack no tiene archivos todavía.</p>
                        ) : (
                          files.map((f) => (
                            <div key={f.filename} className="flex items-center space-x-2">
                              <Checkbox
                                id={`del-${f.filename}`}
                                checked={selectedToDelete.has(f.filename)}
                                onCheckedChange={() => toggleDelete(f.filename)}
                                className="border-white/20 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                              />
                              <Label
                                htmlFor={`del-${f.filename}`}
                                className="text-sm text-gray-300 cursor-pointer font-mono flex items-center gap-2 flex-1 min-w-0"
                              >
                                <span className="truncate">{f.filename}</span>
                                <span className="text-[10px] bg-white/10 text-gray-400 rounded px-1 py-0.5 font-sans shrink-0">{f.type}</span>
                                <span className="text-xs text-muted-foreground shrink-0">({f.sizeMb} MB)</span>
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <Upload className="h-4 w-4 text-accent" /> Añadir archivos
                      </h4>
                      {filesToAdd.length > 0 ? (
                        <div className="space-y-2 bg-background/50 border border-white/5 rounded-md p-3 max-h-[280px] overflow-y-auto">
                          {filesToAdd.map((pf, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm bg-white/5 rounded px-2 py-1.5">
                              <span className="font-mono text-gray-300 truncate flex-1 min-w-0 text-xs">{pf.file.name}</span>
                              <select
                                value={pf.type}
                                onChange={(e) => updateFileType(i, e.target.value as ModFile["type"])}
                                className="bg-background border border-white/10 text-gray-300 text-xs rounded px-1 py-0.5 shrink-0"
                              >
                                {FILE_TYPES.map((t) => (
                                  <option key={t} value={t}>{typeLabel[t]}</option>
                                ))}
                              </select>
                              <button
                                className="text-destructive hover:text-destructive/80 shrink-0 text-xs"
                                onClick={() => removeFileToadd(i)}
                              >✕</button>
                            </div>
                          ))}
                          <div
                            className="border border-white/10 border-dashed rounded-md p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground cursor-pointer hover:bg-white/5 relative"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleFileDrop}
                          >
                            <Upload className="h-3 w-3" /> Añadir más archivos
                            <input type="file" multiple accept=".jar,.zip,.json,.toml,.cfg" className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); }} />
                          </div>
                        </div>
                      ) : (
                        <div
                          className="bg-background/50 border border-white/5 border-dashed rounded-md p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/5 transition-colors relative"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleFileDrop}
                        >
                          <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                          <p className="text-sm font-medium text-gray-200">Arrastra archivos aquí</p>
                          <p className="text-xs text-muted-foreground mt-1">.jar, .zip — puedes subir mods individuales o un zip completo</p>
                          <input
                            type="file"
                            multiple
                            accept=".jar,.zip,.json,.toml,.cfg"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => {
                              if (e.target.files) addFiles(Array.from(e.target.files));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={handlePublish}
                    disabled={publishing || !selectedModpack || (selectedToDelete.size === 0 && filesToAdd.length === 0)}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-8"
                  >
                    {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {publishing ? "Publicando..." : "Publicar versión"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="bg-card border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Nuevo Modpack</DialogTitle>
            <DialogDescription>
              Crea una nueva entrada en el catálogo de GitHub.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>ID único *</Label>
                <Input
                  value={newForm.id}
                  onChange={(e) => setNewForm({ ...newForm, id: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  className="bg-background/50 border-white/10 text-white font-mono"
                  placeholder="mi-modpack"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input
                  value={newForm.name}
                  onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                  className="bg-background/50 border-white/10 text-white"
                  placeholder="Mi Modpack"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                className="bg-background/50 border-white/10 text-white"
                placeholder="Descripción corta del modpack"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Versión MC</Label>
                <Input
                  value={newForm.minecraftVersion}
                  onChange={(e) => setNewForm({ ...newForm, minecraftVersion: e.target.value })}
                  className="bg-background/50 border-white/10 text-white"
                  placeholder="1.20.4"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Loader</Label>
                <select
                  value={newForm.loaderType}
                  onChange={(e) => setNewForm({ ...newForm, loaderType: e.target.value as any })}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {LOADERS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Versión inicial</Label>
                <Input
                  value={newForm.version}
                  onChange={(e) => setNewForm({ ...newForm, version: e.target.value })}
                  className="bg-background/50 border-white/10 text-white"
                  placeholder="1.0.0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>URL de imagen de portada</Label>
              <Input
                value={newForm.imageUrl}
                onChange={(e) => setNewForm({ ...newForm, imageUrl: e.target.value })}
                className="bg-background/50 border-white/10 text-white"
                placeholder="https://... o /nombre.png"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNewDialog(false)}
                className="text-gray-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {creating ? "Creando..." : "Crear modpack"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
