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
import { ArrowLeft, Plus, Trash, Upload, Lock, Loader2, Folder, FolderOpen, ChevronRight, ChevronDown, File } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { publishUpdate, fetchModpackFiles, createModpack, deleteModpack, ModFile, NewModpackData, PendingFile } from "@/services/github";

const LOADERS = ["forge", "fabric", "neoforge", "vanilla"] as const;

function FolderGroup({
  name,
  files,
  selectedToDelete,
  toggleDelete,
  fileDeleteKey,
  allSelected,
  onToggleAll,
}: {
  name: string;
  files: ModFile[];
  selectedToDelete: Set<string>;
  toggleDelete: (k: string) => void;
  fileDeleteKey: (f: ModFile) => string;
  allSelected: boolean;
  onToggleAll: () => void;
}) {
  const [open, setOpen] = useState(true);
  const someSelected = files.some((f) => selectedToDelete.has(fileDeleteKey(f)));

  return (
    <div className="rounded border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 bg-white/5 hover:bg-white/8 text-xs text-gray-200 font-medium"
      >
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleAll}
          onClick={(e) => e.stopPropagation()}
          className={`h-3 w-3 border-white/30 ${someSelected && !allSelected ? "data-[state=unchecked]:bg-destructive/30" : ""} data-[state=checked]:bg-destructive data-[state=checked]:border-destructive`}
        />
        {open ? <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" /> : <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
        <span className="flex-1 text-left truncate">{name}/</span>
        <span className="text-muted-foreground font-normal">{files.length}</span>
        {open ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
      </button>
      {open && (
        <div className="px-2 py-1 space-y-0.5">
          {files.map((f) => {
            const key = fileDeleteKey(f);
            const displayName = f.path ? f.path.split("/").slice(1).join("/") : f.filename;
            return (
              <div key={key} className="flex items-center gap-2 py-0.5 pl-4">
                <Checkbox
                  id={`del-${key}`}
                  checked={selectedToDelete.has(key)}
                  onCheckedChange={() => toggleDelete(key)}
                  className="h-3 w-3 border-white/20 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                />
                <Label htmlFor={`del-${key}`} className="text-xs text-gray-300 cursor-pointer font-mono flex items-center gap-1.5 flex-1 min-w-0">
                  <File className="h-3 w-3 text-gray-500 shrink-0" />
                  <span className="truncate">{displayName}</span>
                  <span className="text-[10px] bg-white/10 text-gray-400 rounded px-1 font-sans shrink-0">{f.type}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{f.sizeMb}MB</span>
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PendingFileTree({
  filesToAdd,
  updateFileType,
  removeFileToadd,
  FILE_TYPES,
  typeLabel,
}: {
  filesToAdd: PendingFile[];
  updateFileType: (i: number, t: ModFile["type"]) => void;
  removeFileToadd: (i: number) => void;
  FILE_TYPES: ModFile["type"][];
  typeLabel: Record<ModFile["type"], string>;
}) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const grouped: Record<string, Array<{ pf: PendingFile; i: number }>> = {};
  filesToAdd.forEach((pf, i) => {
    const group = pf.relativePath ? pf.relativePath.split("/")[0] : "__flat";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push({ pf, i });
  });

  const toggleFolder = (name: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    const folderNames = Object.keys(grouped).filter((k) => k !== "__flat");
    if (folderNames.length > 0) {
      setOpenFolders((prev) => {
        const next = new Set(prev);
        folderNames.forEach((k) => next.add(k));
        return next;
      });
    }
  }, [filesToAdd.length]);

  return (
    <div className="space-y-1">
      {Object.entries(grouped).map(([group, items]) => {
        if (group === "__flat") {
          return items.map(({ pf, i }) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-white/5 rounded px-2 py-1.5">
              <File className="h-3 w-3 text-gray-500 shrink-0" />
              <span className="font-mono text-gray-300 truncate flex-1 min-w-0 text-xs">{pf.file.name}</span>
              <select
                value={pf.type}
                onChange={(e) => updateFileType(i, e.target.value as ModFile["type"])}
                className="bg-background border border-white/10 text-gray-300 text-xs rounded px-1 py-0.5 shrink-0"
              >
                {FILE_TYPES.map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}
              </select>
              <button className="text-destructive hover:text-destructive/80 shrink-0 text-xs" onClick={() => removeFileToadd(i)}>✕</button>
            </div>
          ));
        }
        const isOpen = openFolders.has(group);
        return (
          <div key={group} className="rounded border border-white/5 overflow-hidden">
            <button
              onClick={() => toggleFolder(group)}
              className="w-full flex items-center gap-2 px-2 py-1.5 bg-white/5 hover:bg-white/8 text-xs text-gray-200 font-medium"
            >
              {isOpen ? <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" /> : <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
              <span className="flex-1 text-left">{group}/</span>
              <span className="text-muted-foreground font-normal">{items.length} archivos</span>
              {isOpen ? <ChevronDown className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />}
            </button>
            {isOpen && (
              <div className="px-2 py-1 space-y-0.5">
                {items.map(({ pf, i }) => {
                  const displayName = pf.relativePath ? pf.relativePath.split("/").slice(1).join("/") : pf.file.name;
                  return (
                    <div key={i} className="flex items-center gap-2 pl-4 py-0.5">
                      <File className="h-3 w-3 text-gray-500 shrink-0" />
                      <span className="font-mono text-gray-300 truncate flex-1 min-w-0 text-xs" title={pf.relativePath}>{displayName}</span>
                      <button className="text-destructive hover:text-destructive/80 shrink-0 text-xs" onClick={() => removeFileToadd(i)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const [publishProgress, setPublishProgress] = useState<{ done: number; total: number; file: string } | null>(null);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newForm, setNewForm] = useState<NewModpackData>(emptyForm());
  const [creating, setCreating] = useState(false);

  const [packToDelete, setPackToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    if (authenticated && modpacks.length === 0) loadModpacks();
  }, [authenticated]);

  useEffect(() => {
    if (!selectedModpack) { setFiles([]); return; }
    const repoUrl = localStorage.getItem("githubRepo") ?? "";
    const token = localStorage.getItem("githubToken") ?? "";
    fetchModpackFiles(repoUrl, selectedModpack, token || undefined).then(setFiles);
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
    if (!token) {
      toast.error("Necesitas un token de GitHub en Ajustes antes de publicar.");
      return;
    }
    if (!repoUrl) {
      toast.error("Configura la URL del repositorio en Ajustes.");
      return;
    }
    setPublishing(true);
    setPublishProgress(null);
    try {
      await publishUpdate(
        token,
        repoUrl,
        selectedModpack,
        Array.from(selectedToDelete),
        filesToAdd,
        newVersion || undefined,
        (done, total, file) => setPublishProgress({ done, total, file })
      );
      toast.success("Actualización publicada correctamente en GitHub");
      setSelectedModpack("");
      setPublishProgress(null);
      loadModpacks();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al publicar");
    } finally {
      setPublishing(false);
      setPublishProgress(null);
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

  const handleDeleteModpack = async () => {
    if (!packToDelete) return;
    const token = localStorage.getItem("githubToken") ?? "";
    const repoUrl = localStorage.getItem("githubRepo") ?? "";
    setDeleting(true);
    try {
      await deleteModpack(token, repoUrl, packToDelete.id);
      toast.success(`Modpack "${packToDelete.name}" eliminado de GitHub.`);
      setPackToDelete(null);
      if (selectedModpack === packToDelete.id) setSelectedModpack("");
      loadModpacks();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar el modpack");
    } finally {
      setDeleting(false);
    }
  };

  const toggleDelete = (key: string) => {
    const next = new Set(selectedToDelete);
    if (next.has(key)) next.delete(key); else next.add(key);
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
    const ext = low.split(".").pop() ?? "";
    if (ext === "jar") return "mod";
    if (ext === "zip") {
      if (low.includes("shader") || low.includes("shad")) return "shader";
      if (low.includes("resource") || low.includes("texture")) return "resourcepack";
      return "bundle";
    }
    if (["png", "ogg"].includes(ext)) return "resourcepack";
    return "config";
  };

  const guessTypeFromPath = (relPath: string): ModFile["type"] | null => {
    const top = relPath.split("/")[0].toLowerCase();
    if (top === "mods") return "mod";
    if (top === "config") return "config";
    if (top === "resourcepacks") return "resourcepack";
    if (top === "shaderpacks") return "shader";
    return null;
  };

  const SYSTEM_FILES = new Set([".ds_store", "thumbs.db", "desktop.ini", ".gitkeep"]);
  const isSystemFile = (name: string) => SYSTEM_FILES.has(name.toLowerCase());

  const MC_EXTENSIONS = [
    ".jar", ".zip",
    ".json", ".json5", ".jsonc",
    ".toml", ".cfg", ".properties",
    ".txt", ".dat", ".dat_old",
    ".nbt", ".snbt",
    ".yaml", ".yml",
    ".mcmeta", ".lang", ".zs", ".js",
    ".png", ".ogg",
  ];

  const addFiles = (newFiles: File[]) => {
    const filtered = newFiles.filter((f) =>
      !isSystemFile(f.name) &&
      MC_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    const pending: PendingFile[] = filtered.map((file) => ({ file, type: guessType(file.name) }));
    setFilesToAdd((prev) => [...prev, ...pending]);
  };

  const addFolder = (folderFiles: FileList) => {
    const pending: PendingFile[] = [];
    for (const file of Array.from(folderFiles)) {
      if (isSystemFile(file.name)) continue;
      const relPath = (file as any).webkitRelativePath as string || file.name;
      const type = guessTypeFromPath(relPath) ?? guessType(file.name);
      pending.push({ file, type, relativePath: relPath });
    }
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

  const fileDeleteKey = (f: ModFile) => f.path ?? f.filename;

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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setPackToDelete({ id: pack.id, name: pack.name })}
                          title="Eliminar modpack"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
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
                    {/* ── Eliminar archivos ── */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <Trash className="h-4 w-4 text-destructive" /> Eliminar archivos
                      </h4>
                      <div className="bg-background/50 border border-white/5 rounded-md p-3 space-y-1 max-h-[320px] overflow-y-auto">
                        {files.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Este modpack no tiene archivos todavía.</p>
                        ) : (() => {
                          const grouped: Record<string, ModFile[]> = {};
                          for (const f of files) {
                            const group = f.path ? f.path.split("/")[0] : "__root";
                            if (!grouped[group]) grouped[group] = [];
                            grouped[group].push(f);
                          }
                          const groups = Object.entries(grouped);
                          return groups.map(([group, groupFiles]) => {
                            if (group === "__root") {
                              return groupFiles.map((f) => {
                                const key = fileDeleteKey(f);
                                return (
                                  <div key={key} className="flex items-center space-x-2 py-0.5 pl-1">
                                    <Checkbox
                                      id={`del-${key}`}
                                      checked={selectedToDelete.has(key)}
                                      onCheckedChange={() => toggleDelete(key)}
                                      className="border-white/20 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                                    />
                                    <Label htmlFor={`del-${key}`} className="text-xs text-gray-300 cursor-pointer font-mono flex items-center gap-1.5 flex-1 min-w-0">
                                      <File className="h-3 w-3 text-gray-500 shrink-0" />
                                      <span className="truncate">{f.filename}</span>
                                      <span className="text-[10px] bg-white/10 text-gray-400 rounded px-1 font-sans shrink-0">{f.type}</span>
                                    </Label>
                                  </div>
                                );
                              });
                            }
                            const allSelected = groupFiles.every((f) => selectedToDelete.has(fileDeleteKey(f)));
                            return (
                              <FolderGroup
                                key={group}
                                name={group}
                                files={groupFiles}
                                selectedToDelete={selectedToDelete}
                                toggleDelete={toggleDelete}
                                fileDeleteKey={fileDeleteKey}
                                allSelected={allSelected}
                                onToggleAll={() => {
                                  const next = new Set(selectedToDelete);
                                  groupFiles.forEach((f) => {
                                    const k = fileDeleteKey(f);
                                    if (allSelected) next.delete(k); else next.add(k);
                                  });
                                  setSelectedToDelete(next);
                                }}
                              />
                            );
                          });
                        })()}
                      </div>
                      {selectedToDelete.size > 0 && (
                        <p className="text-xs text-destructive/80">{selectedToDelete.size} archivo{selectedToDelete.size !== 1 ? "s" : ""} marcado{selectedToDelete.size !== 1 ? "s" : ""} para eliminar</p>
                      )}
                    </div>

                    {/* ── Añadir archivos ── */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <Upload className="h-4 w-4 text-accent" /> Añadir archivos
                      </h4>

                      {filesToAdd.length > 0 ? (
                        <div className="space-y-1 bg-background/50 border border-white/5 rounded-md p-3 max-h-[320px] overflow-y-auto">
                          <PendingFileTree
                            filesToAdd={filesToAdd}
                            updateFileType={updateFileType}
                            removeFileToadd={removeFileToadd}
                            FILE_TYPES={FILE_TYPES}
                            typeLabel={typeLabel}
                          />
                          <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
                            <div className="relative flex-1">
                              <button className="w-full border border-white/10 border-dashed rounded px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 flex items-center justify-center gap-1.5">
                                <Upload className="h-3 w-3" /> Archivos
                              </button>
                              <input type="file" multiple accept=".jar,.zip,.json,.json5,.jsonc,.toml,.cfg,.properties,.txt,.dat,.dat_old,.nbt,.snbt,.yaml,.yml,.mcmeta,.lang,.zs,.js,.png,.ogg" className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
                            </div>
                            <div className="relative flex-1">
                              <button className="w-full border border-accent/30 border-dashed rounded px-3 py-1.5 text-xs text-accent/80 hover:bg-accent/5 flex items-center justify-center gap-1.5">
                                <Folder className="h-3 w-3" /> Carpeta
                              </button>
                              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer"
                                {...{ webkitdirectory: "", multiple: true } as any}
                                onChange={(e) => { if (e.target.files) addFolder(e.target.files); e.target.value = ""; }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div
                            className="bg-background/50 border border-white/5 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/5 transition-colors relative"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleFileDrop}
                          >
                            <Upload className="h-7 w-7 text-muted-foreground mb-2" />
                            <p className="text-sm font-medium text-gray-200">Arrastra archivos aquí</p>
                            <p className="text-xs text-muted-foreground mt-1">.jar, .zip, .json, .txt, .dat, .toml, .nbt y más</p>
                            <input type="file" multiple accept=".jar,.zip,.json,.json5,.jsonc,.toml,.cfg,.properties,.txt,.dat,.dat_old,.nbt,.snbt,.yaml,.yml,.mcmeta,.lang,.zs,.js,.png,.ogg" className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); }} />
                          </div>
                          <div className="relative">
                            <button className="w-full border border-accent/40 border-dashed rounded-md px-4 py-3 text-sm text-accent hover:bg-accent/10 transition-colors flex items-center justify-center gap-2 font-medium">
                              <Folder className="h-4 w-4" /> Subir carpeta completa
                            </button>
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer"
                              {...{ webkitdirectory: "", multiple: true } as any}
                              onChange={(e) => { if (e.target.files) addFolder(e.target.files); e.target.value = ""; }} />
                          </div>
                          <p className="text-xs text-muted-foreground text-center">Selecciona una carpeta y se subirán todos sus archivos manteniendo la estructura</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {publishProgress && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="truncate max-w-[70%]">Subiendo: <span className="text-gray-300 font-mono">{publishProgress.file}</span></span>
                      <span className="shrink-0">{publishProgress.done} / {publishProgress.total}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-accent h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${publishProgress.total > 0 ? (publishProgress.done / publishProgress.total) * 100 : 0}%` }}
                      />
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
                    {publishing
                      ? publishProgress
                        ? `Subiendo ${publishProgress.done}/${publishProgress.total}...`
                        : "Preparando..."
                      : "Publicar versión"}
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

      <Dialog open={!!packToDelete} onOpenChange={(open) => { if (!open && !deleting) setPackToDelete(null); }}>
        <DialogContent className="bg-card border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash className="h-5 w-5 text-destructive" />
              Eliminar modpack
            </DialogTitle>
            <DialogDescription className="text-gray-400 pt-1">
              ¿Seguro que quieres eliminar <span className="text-white font-semibold">"{packToDelete?.name}"</span>?
              <br /><br />
              Esto borrará la entrada del catálogo y su manifiesto de GitHub. Los archivos del GitHub Release asociado <span className="text-amber-400">no se eliminan</span> automáticamente. La instancia local instalada en los usuarios tampoco se toca.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 gap-2">
            <Button
              variant="ghost"
              onClick={() => setPackToDelete(null)}
              disabled={deleting}
              className="text-gray-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteModpack}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white font-bold"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleting ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
