# Forest Biometrics & 3D Tree Model Analyzer

A browser-based React application built with TypeScript, Vite, and Tailwind CSS for analyzing and visualizing forest biometrics. This application provides 3D model visualization (meshes and point clouds), biometric parameter estimation, and an AI-powered conversational assistant.

## Features & Project Modules

### 1. 3D Display (`src/components/TreeModelViewer.tsx`)
This core module handles the immersive, interactive 3D rendering of trees, foliage, and forestry environments.
- **Supported Formats**: Imports `.gltf`, `.glb`, `.obj` (3D meshes), and `.ply` (photogrammetry point clouds).
- **Point Cloud Optimization**: Provides interactive multi-step control to adjust particle rendering sizes dynamically (Point Size `+` / `-`).
- **Axis Correction / Reorientation**: Includes custom, user-triggered 90-degree rotations in three independent axes (`Rot X`, `Rot Y`, `Rot Z`) to handle misaligned coordinate systems (e.g., Z-up/Y-up issues) and prevent models from importing upside-down.
- **Lighting & Shadows**: Implements real-time double-sided shadows and mesh normal recalculation to prevent "ghost" or hollow rendering artifacts on arbitrary `.obj` imports.

### 2. Biometrics Panel (`src/components/BiometricsPanel.tsx`)
Responsible for displaying and modifying estimated structural properties of the analyzed specimens.
- **Specimen Dimensions**: Monitors total height, canopy sprawl, crown volume score, and DBH (Diameter at Breast Height).
- **Forest Metrics**: Tracks stem counts, estimated structural timber biomass, carbon capture indexing, and density parameters.
- **Visual Feedback**: Syncs parameters in real-time with the analyzed bounding dimensions of any imported 3D mesh or point cloud dynamically calculated by the viewer.

### 3. Local LLM / Chatbot (`src/components/Chatbot.tsx`)
An interactive, conversational assistant UI layer designed for querying forest metrics, asking forestry analysis questions, and obtaining guidance on biometric calculations.
- Includes smooth scrollable messaging feeds and real-time prompt handlers.
- Easily adaptable/configurable to interface with server-side AI integrations or local inference endpoints.

---

## Technical Stack & Configuration Files

- **Framework**: React 18, TypeScript, and Vite.
- **3D Engine**: Three.js, React Three Fiber (R3F), and `@react-three/drei` (providing OrbitControls, grid helpers, loaders, etc.).
- **Styling**: Tailwind CSS for responsive layout design.
- **Icons**: Lucide React.

---

## Understanding the Configuration JSON Files

To make working in this codebase or migrating to other platforms smooth, here is a breakdown of the key JSON control files found in the project root:

### 1. `package.json` (The Core Recipe)
Think of this as the main manifest of your Node.js project. It lists:
- **Project Identity**: Name, description, and version.
- **Development Scripts**: Tasks like `npm run dev` (starts development server) or `npm run build` (bundles assets for production).
- **Dependency Map**: The primary external modules the app relies on (such as `three`, `react-three-fiber`, `lucide-react`, and `tailwindcss`).

### 2. `package-lock.json` (The Version Lock)
This is an automatically generated file that acts as an exact snapshot of the entire dependency graph. While `package.json` lists *what* libraries are needed (often using loose version ranges), `package-lock.json` locks the *precise* exact version and download source for every sub-dependency. This ensures anyone who downloads your scripts gets a mathematically identical build. **You should never edit this file manually.**

### 3. `tsconfig.json` (The Compiler Blueprint)
This directs the TypeScript compiler (`tsc`) on how to translate TypeScript code (`.ts` and `.tsx`) into standard JavaScript that browsers understand. It defines strictness levels, path mappings, component compilation rules, and compatibility targets.

### 4. `metadata.json` (The Platform Manifest)
This is a workspace-specific configuration file utilized by the hosting environment. See below for a fuller explanation of what a manifest is.

---

## What is an Application "Manifest"?

In software engineering, a **manifest** is a metadata file that accompanies a program or project to describe its identity, requisites, permissions, and behavior to an external operating environment or browser, rather than holding executable logic itself.

In this project, **`metadata.json`** acts as the application's platform-level manifest. Here is what its attributes control inside the workspace:

- `"name"`: The user-facing name of your application displayed on dashboards and browser tabs.
- `"description"`: A human-readable summary detailing the purpose of the app.
- `"requestFramePermissions"`: Lists native hardware capabilities (like `["camera", "microphone", "geolocation"]`) that the iframe wrapper of the sandbox needs to request from your browser.
- `"majorCapabilities"`: Registers system-level integration flags (such as `["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`) telling the server proxy layers which backend features are enabled.

