# ALaunchi — Empaquetar como App de Escritorio

## Pre-requisitos

- Node.js 20+ y pnpm instalados localmente
- Git

## Pasos para empaquetar

### 1. Clonar y instalar dependencias

```bash
git clone <tu-repo>
cd artifacts/alaunchi
pnpm install
pnpm add -D electron electron-builder
```

### 2. Construir el frontend

```bash
pnpm build
```

### 3. Empaquetar para tu sistema operativo

```bash
# Windows (.exe instalador)
pnpm dlx electron-builder --win

# macOS (.dmg)
pnpm dlx electron-builder --mac

# Linux (.AppImage)
pnpm dlx electron-builder --linux
```

Los ejecutables se generarán en la carpeta `release/`.

## Estructura de datos en GitHub

Para que el launcher cargue tus modpacks desde GitHub, crea un repositorio público con esta estructura:

```
tu-repo/
  modpacks.json           ← Lista de todos los modpacks
  modpacks/
    vanilla-plus/
      manifest.json       ← Archivos del modpack y versión actual
    survival-pro/
      manifest.json
```

### Formato de `modpacks.json`

```json
[
  {
    "id": "vanilla-plus",
    "name": "VANILLA+",
    "description": "Experiencia vanilla pulida",
    "minecraftVersion": "1.20.4",
    "loaderType": "vanilla",
    "version": "1.0.0",
    "imageUrl": "https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/modpacks/vanilla-plus/cover.png",
    "fileCount": 45,
    "totalSizeMb": 250
  }
]
```

### Formato de `manifest.json` de cada modpack

```json
{
  "id": "vanilla-plus",
  "version": "1.0.1",
  "files": [
    {
      "filename": "sodium-0.5.8.jar",
      "type": "mod",
      "sizeMb": 1.5,
      "downloadUrl": "https://github.com/TU_USUARIO/TU_REPO/releases/download/vanilla-plus-v1.0.1/sodium-0.5.8.jar"
    }
  ],
  "filesToDelete": []
}
```

## Panel de administración

Accede desde dentro de la app en Ajustes → Panel Admin.
Contraseña por defecto: `admin123` (cámbiala en Ajustes).

Para publicar updates necesitas un GitHub Personal Access Token con permisos `repo` y `write:packages`.
