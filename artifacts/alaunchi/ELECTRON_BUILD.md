# ALaunchi — Modo desarrollo y empaquetado

## Pre-requisitos

- **Node.js 20 o superior** — https://nodejs.org
- **pnpm** — instalar con `npm install -g pnpm`
- **Java 17+** — para lanzar Minecraft (https://adoptium.net)

---

## Modo desarrollo (app de escritorio)

```bash
# 1. Entra a la carpeta del launcher
cd artifacts/alaunchi

# 2. Instala todas las dependencias (incluye Electron)
pnpm install

# 3. Arranca en modo desarrollo
pnpm run electron:dev
```

Esto levanta dos procesos a la vez:
- **VITE** — servidor de desarrollo en `http://localhost:5173`
- **ELECTRON** — ventana nativa que carga ese servidor

Los cambios en el código se reflejan en caliente (hot reload) en la ventana de Electron.
Las DevTools de Chromium se abren automáticamente en una ventana separada.

---

## Empaquetar para distribución

```bash
# Windows (.exe instalador)
pnpm run electron:build:win

# macOS (.dmg)
pnpm run electron:build:mac

# Linux (.AppImage)
pnpm run electron:build:linux
```

Los ejecutables se generan en la carpeta `release/`.

> **Nota para Windows:** La primera vez puede tardar unos minutos porque electron-builder descarga las herramientas nativas de empaquetado.

---

## Estructura del repositorio de modpacks en GitHub

Crea un repositorio público (o privado con token) con esta estructura:

```
tu-repo/
  modpacks.json                     ← lista de todos los modpacks
  modpacks/
    vanilla-plus/
      manifest.json                 ← archivos y URLs de descarga
    survival-pro/
      manifest.json
```

### `modpacks.json`

```json
[
  {
    "id": "vanilla-plus",
    "name": "VANILLA+",
    "description": "Experiencia vanilla pulida",
    "minecraftVersion": "1.20.4",
    "loaderType": "vanilla",
    "version": "1.0.0",
    "imageUrl": "https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/modpacks/vanilla-plus/cover.jpg",
    "fileCount": 45,
    "totalSizeMb": 250
  }
]
```

### `modpacks/{id}/manifest.json`

```json
{
  "files": [
    {
      "filename": "sodium-0.5.8.jar",
      "type": "mod",
      "sizeMb": 1.5,
      "downloadUrl": "https://github.com/TU_USUARIO/TU_REPO/releases/download/vanilla-plus-v1.0.0/sodium-0.5.8.jar"
    }
  ]
}
```

---

## Panel de administración

- Accede pulsando **ADMIN** en la pantalla principal
- Contraseña por defecto: `admin123` (cámbiala en Ajustes)
- Para publicar actualizaciones necesitas:
  1. Un repositorio GitHub configurado en Ajustes (formato `usuario/repo`)
  2. Un **GitHub Personal Access Token** con permiso `repo`

---

## Configuración en Ajustes (dentro de la app)

| Campo | Descripción |
|-------|-------------|
| Repositorio GitHub | `usuario/nombre-repo` o URL completa |
| Token GitHub | Solo necesario para el admin (publicar updates) |
| Contraseña Admin | Protege el acceso al panel de administración |
