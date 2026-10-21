# GeoLibre Web / Android 外殼 Audit

- **日期**：2026-10-21
- **GeoLibre pin**：tag `v3.4.0`，commit `31264e594f6bea72935a736a9d7aaa165c4c6294`（`git clone --depth 1 --branch v3.4.0`，只讀，沒有改任何 GeoLibre 檔案）
- **Web 部署**：`web.geolibre.app`（`opengeos/geolibre-web` 的 `gh-pages`，HEAD `3d77a2e46f65ca7be4370b711d5ab9f64e3f6306`）；CSP 以實際 HTTP header 為準
- **本地 repo**：`/workspace` = `ykwanstudy-lab/Arbotic-Twin_Prototypes-`
- **`apps/map-plugin`**：**未找到**。`/workspace` 只有 `README.md`、`index.html`、`package.json`、`src/` 等；`find / -maxdepth 6 -type d -name map-plugin` 無結果；`gh repo list ykwanstudy-lab` 的 7 個 repo 亦無含 `apps/map-plugin` 的 repo。因此所有關於 `apps/map-plugin` 的具體斷言，本 audit 一律寫「未找到」，不估算。

---

## 0. TL;DR

| 項目 | 結論 |
|---|---|
| (1) LICENSE 可否重新包裝成自己的 Android APK | **可以**（MIT：use / copy / modify / merge / publish / distribute / sublicense / sell），但每個 copy 要保留 copyright + permission notice。**商標條款未找到**；MIT 文本本身不授權 GeoLibre 名稱／logo。 |
| (2) Tauri API 在純 web / Capacitor | 61 個 import 位、41 個檔案；`isTauri()` 只認 `window.__TAURI_INTERNALS__`。Capacitor 不會有這個 object → 走 browser fallback；desktop-only 功能會缺席，但程式碼有明確 fallback 或明確 throw，未找到 top-level `invoke`。`app.openExternalUrl` 在 web fallback 是 `window.open`；Capacitor 外開行為需實測（repo 內 `capacitor` 0 命中）。 |
| (3) CSP / frame-src | **Tauri build 與 docker nginx web build 都會擋外部 viewer domain**（`frame-src` 只准 self / localhost / Google）。`web.geolibre.app`（GitHub Pages）**完全沒有 CSP header**，所以不擋；Capacitor 外殼由我們自己的 CSP 決定。`connect-src` 兩邊都容許 `https:` → API domain 不受 CSP 擋。 |
| (4) Plugin loader | manifest 必須 HTTPS（localhost 例外）；manifest 只認 `id/name/version/entry` 等固定欄位；entry 必須 `.js/.mjs`、以 blob `import()` 載入、export default 或 `plugin`；export 的 id/name/version 必須與 manifest 完全一致；entry+style 50MB 上限；URL plugin 有 SHA-256 trust-on-first-use pin，內容一變就 held back。全部在 web 也生效。 |
| (5) 相機 / 檔案 / 大檔 | **沒有相機 API、沒有 `getUserMedia({video:true})`、沒有攝影測量（SfM/photogrammetry）**。唯一的 `getUserMedia` 是語音指令的**麥克風**。檔案輸入是標準 `<input type="file">`；field photo 上限 **2MB**、georeferencer 圖 **8MB**、local glTF **24MB**、plugin asset **50MB**。未找到通用大檔上載 endpoint／上載 size cap。 |
| **Android 外殼** | **外殼本身沒有 shell-level A0 blocker**（MIT + web fallback + plugin loader 可用）。產品層缺口是「拍攝畫面」：GeoLibre 沒有 capture / photogrammetry，但同一個 Capacitor 外殼可以用原生 CameraX/ARCore 模組補；GeoLibre 只負責地圖／圖層／tree info。唔需要拆成兩個產品。 |

---

## 1. LICENSE：可否重新包裝成自己的 Android APK 分發？

### 1.1 原文

`LICENSE:1-13`：

> ```
> 1  MIT License
> 2
> 3  Copyright (c) 2026 Qiusheng Wu
> 4
> 5  Permission is hereby granted, free of charge, to any person obtaining a copy
> 6  of this software and associated documentation files (the "Software"), to deal
> 7  in the Software without restriction, including without limitation the rights
> 8  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> 9  copies of the Software, and to permit persons to whom the Software is
> 10 furnished to do so, subject to the following conditions:
> 11
> 12 The above copyright notice and this permission notice shall be included in all
> 13 copies or substantial portions of the Software.
> ```

`README.md:214-216`：

> ```
> 214 ## License
> 215
> 216 [MIT](LICENSE)
> ```

### 1.2 判定

- **可以**重新編譯／修改／打包成自己的 Android APK 分發，甚至收費、sublicense；MIT 條文明確列出 `use, copy, modify, merge, publish, distribute, sublicense, and/or sell`（`LICENSE:7-9`）。
- **條件**：每個 copy／substantial portion 要包含 `Copyright (c) 2026 Qiusheng Wu` 與這段 permission notice（`LICENSE:12-13`）。實務上把 `LICENSE` 放進 APK 的 About／授權頁即可（未找到 repo 對顯示方式有額外要求）。
- **商標**：`grep -rn -i trademark` 在 pinned repo 內 **未找到**任何 trademark policy；`LICENSE` 文本亦沒有提及 name/logo。MIT 只授權 software，不自動授權用 “GeoLibre” 名稱／logo 做你的 app 品牌。這點是法律事實，不是 repo 內有明文允許。
- `package.json` **沒有 `license` 欄位**（`python3` 讀取結果 `license: None`），所以 `LICENSE` 檔是唯一授權來源。
- **未找到** `NOTICE` 檔（`ls | grep -iE 'license|notice'` 只有 `LICENSE`）。第三方 basemap／服務／字體授權不在這份 MIT 內；本 audit 未逐一核。


---

## 2. 所有 Tauri 專屬 API、`app.openExternalUrl` 實作，以及純 web / Capacitor 行為

### 2.1 掃描結果

- `@tauri-apps/*` 的 import／`await import` 共 **61 個位置、41 個檔案**（`grep -rn --include=*.ts --include=*.tsx -E 'import .*"@tauri-apps|await import\("@tauri-apps' apps packages`，已排除 `src-tauri/vendor`）。完整檔案清單見 Appendix A。
- `window.__TAURI__`：**未找到**（0 命中）。
- 實際 runtime 偵測只用 `window.__TAURI_INTERNALS__`：

`apps/geolibre-desktop/src/lib/is-tauri.ts:7-9`：

> ```ts
> 7 export function isTauri(): boolean {
> 8   return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
> 9 }
> ```

`apps/geolibre-desktop/src/lib/app-api.ts:986-990`：

> ```ts
> 986 /** Whether the app runs in the Tauri desktop webview. */
> 987 export function isTauriRuntime(): boolean {
> 988   if (typeof window === "undefined") return false;
> 989   return Boolean((window as TauriRuntimeWindow).__TAURI_INTERNALS__);
> 990 }
> ```

**推論（有 code 依據）**：純 web 與 Capacitor WebView 都不會注入 `__TAURI_INTERNALS__`，所以 `isTauri()` / `isTauriRuntime()` 一律 `false`，所有 `if (isTauri())` 分支都會走 browser 路徑。

### 2.2 `app.openExternalUrl` 完整實作鏈

`packages/plugins/src/types.ts:943-950`（plugin 看到的 API）：

> ```ts
> 943   /**
> 944    * Open an http(s) URL in the system browser. Needed because the Tauri
> 945    * desktop webview ignores `window.open`/`target="_blank"` and would open the
> 946    * link inside the app instead; the host routes through the opener plugin
> 947    * there and falls back to `window.open` on the web build. Non-http(s) URLs
> 948    * are ignored. Plugins should call this rather than `window.open` directly.
> 949    */
> 950   openExternalUrl?: (url: string) => void;
> ```

`apps/geolibre-desktop/src/lib/app-api.ts:574`（接到 host 實作）：

> ```ts
> 574     openExternalUrl: (url: string) => void openExternalLink(url),
> ```

`apps/geolibre-desktop/src/lib/open-external.ts:1-6, 16-30`：

> ```ts
> 1 import { openUrl } from "@tauri-apps/plugin-opener";
> 2 import { isTauri } from "./tauri-io";
> 3
> 4 // Open a link in the system browser. The Tauri webview ignores
> 5 // target="_blank"/window.open, so route through the opener plugin there and
> 6 // fall back to window.open on the web build.
> ...
> 16   if (isTauri()) {
> ...
> 21       await openUrl(url);
> ...
> 26   }
> 27   // window.open from this click (a user gesture) is normally allowed, but a
> 28   // strict popup blocker can still return null; log it so the dead click is
> 29   // debuggable rather than silent.
> 30   const opened = window.open(url, "_blank", "noopener,noreferrer");
> ```

**在純 web / Capacitor 的實際行為**：

- `isTauri() === false` → 走 `window.open`（`open-external.ts:30`）。
- 純 web：正常彈新 tab（popup blocker 可能回 `null`，只 log warning，不 throw）。
- **Capacitor**：repo 內 `grep -rni capacitor` **0 命中**，即沒有 Capacitor 專用處理。`window.open` 在 Android WebView 是否開系統 browser，取決於 WebView 的 `WebChromeClient` / `shouldOverrideUrlLoading` 實作；**不能假設它一定開到**。要外開請用 `@capacitor/browser`（本 repo 沒有這個依賴）或自訂 bridge。
- 這也意味 `target="_blank"` 在 Tauri 無效（`open-external.ts:4-6` 原文），在 Capacitor 亦不一定有效；plugin 應統一用 `app.openExternalUrl?.()`。

### 2.3 關鍵 Tauri API 的 web fallback / 缺失（逐項）

| 功能 | 實作位置（Tauri） | 純 web / Capacitor |
|---|---|---|
| 檔案對話框 | `apps/geolibre-desktop/src/lib/file-io/file-dialogs.ts:7-8`（`@tauri-apps/plugin-dialog` / `plugin-fs`） | `file-dialogs.ts:217` `if (isTauri())`；否則 `file-dialogs.ts:239-264` 建 `<input type="file">`。**可用**。 |
| 檔案輸入取消 | 同上 | `packages/plugins/src/types.ts:1018-1021` 明講 web 的 `<input type="file">` 不會 fire cancel，`importTextFile` 的 promise 會永遠 pending。**要自己處理**。 |
| 地理位置 | `apps/geolibre-desktop/src/lib/geolocation.ts:115,134,163`（`@tauri-apps/plugin-geolocation`） | `geolocation.ts:30-31`：`return isTauri() && isMobile();` 否則走 `navigator.geolocation`。**可用**（Capacitor 需 WebView geolocation permission）。 |
| Plugin native fetch | `apps/geolibre-desktop/src/lib/plugin-native-fetch.ts:13`；`app-api.ts:474` | `nativeFetch: isTauriRuntime() ? pluginNativeFetch() : undefined`。**web / Capacitor 是 `undefined`**，plugin 必須 optional-chain，否則 TypeError。 |
| Sidecar（Python） | `apps/geolibre-desktop/src/lib/sidecar.ts:1,31` | `sidecar.ts:74-76`：`if (!isTauri()) throw new Error("Starting the processing server requires GeoLibre Desktop.")`。**明確失敗，不會靜默**。 |
| Plugin zip 安裝 | `apps/geolibre-desktop/src/hooks/usePlugins.ts:137-138,612` | `usePlugins.ts:588-590`：`if (!isTauriRuntime()) throw new Error("Installing plugin archives requires the desktop app.")`。**manifest URL 安裝仍可用**（走 `external-plugins.ts`）。 |
| Keychain | `apps/geolibre-desktop/src/lib/credential-store.ts:11,39` | `credential-hydration.ts:58-59`：`if (credentialStorageLocation() !== "keychain") return;` 所以 web 不會呼叫 `readSecureCredentials`；`credentialStorageLocation()` 在非 desktop 回 `"browser"`（`credential-store.ts:17-19`）。**但 `readSecureCredentials` 本身沒有 guard**，直接呼叫會 invoke 而 throw。 |
| Deployment policy | `apps/geolibre-desktop/src/lib/deployment-policy.ts:9,453` | `deployment-policy.ts:451` `if (isTauri())` 才 `invoke("read_deployment_policy")`；否則讀 bundled web file fallback。**可用**。 |
| File Geodatabase | `apps/geolibre-desktop/src/components/layout/add-data/sources/GdbSource.tsx:13-14` | `GdbSource.tsx:108`：`const desktop = isTauri() && !IS_MAS_BUILD;`；web 不提供 GDB。**功能缺席，不 crash**。 |
| Local directory / Zarr | `apps/geolibre-desktop/src/lib/zarr-directory-picker.ts:16-17` | `zarr-directory-picker.ts:40`：`if (isTauri()) return true;`；否則 browser picker 路徑。 |
| MBTiles / XYZ / S3 signing | `apps/geolibre-desktop/src/lib/mbtiles.ts:2`、`xyz-url.ts:2`、`s3-signer.ts:18` | 三者都有 `if (!isTauri())` guard（`mbtiles.ts:26`、`xyz-url.ts:83,200,276`、`s3-signer.ts:102,176,444`）。**web 走 URL 路徑或直接 no-op**。 |
| Martin / Jupyter / native HTTP | `apps/geolibre-desktop/src/lib/martin.ts:1`、`jupyter.ts:1`、`native-http.ts:14` | 只在 desktop UI 使用；沒有 web 等價物。**功能缺席**。 |
| Deep link / OAuth popup | `apps/geolibre-desktop/src/lib/native-share-auth.ts:180`、`native-coordinate-open.ts:16`、`share-oauth.ts:577`、`arcgis-oauth.ts:393` | 全部 dynamic import，只有在 desktop 分支才載入。**web 不執行**。 |
| Window close guard | `apps/geolibre-desktop/src/hooks/useWindowCloseGuard.ts:24,63` | dynamic import，Tauri window 才有意義；web 不執行。 |
| Plugin directory scan | `apps/geolibre-desktop/src/lib/external-plugins.ts:7`（`invoke`）、`:40`（`isTauri`） | 只在 desktop 掃 `additionalPluginDirectories`；manifest URL / zip / web IndexedDB 路徑不依賴 Tauri。 |

**是否會「壞」**：

- **Import 層**：未找到 top-level `invoke()`；所有 `invoke` 都在 function 內或 dynamic `import()` 後才呼叫，所以 module 載入不會因 `__TAURI_INTERNALS__` 不存在而 throw。
- **Runtime 層**：Tauri-only 功能會依上表 fallback 或明確 throw；不會整頁 crash，但 plugin 若直接呼叫 `app.nativeFetch` / `window.open` / `app.pickLocalDirectoryFiles`，在 web/Capacitor 會 `undefined` 或無效。
- **`apps/map-plugin`**：**未找到**，所以無法確認它有沒有用 `app.nativeFetch`、`window.open`、`pickLocalDirectoryFiles` 或任何 Tauri API。


---

## 3. CSP / frame-src 在邊度，會唔會擋 viewer 或 API domain

### 3.1 Tauri build（desktop / iOS / Android store app）

`apps/geolibre-desktop/src-tauri/tauri.conf.json:24`：

> ```json
> "csp": "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost asset: data: blob: https: http: http://asset.localhost wss://collab.geolibre.app wss://stream.aisstream.io ws://127.0.0.1:* ws://localhost:*; img-src 'self' asset: data: blob: https: http://asset.localhost; media-src 'self' blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data: https://js.arcgis.com/; script-src 'self' blob: 'unsafe-eval' 'wasm-unsafe-eval' ... ; child-src 'self' http://127.0.0.1:* http://localhost:* https://accounts.google.com https://www.google.com; frame-src 'self' http://127.0.0.1:* http://localhost:* https://accounts.google.com https://www.google.com; worker-src blob: 'self'"
> ```

（上面為了可讀性省略了 `script-src` 中間的 CDN 清單；`frame-src` 是完整原文。）

- `frame-src` **只准** `'self'`、`http://127.0.0.1:*`、`http://localhost:*`、`https://accounts.google.com`、`https://www.google.com`。
- 你的 viewer 若在 `https://<domain>/viewer/...` → **被擋**。
- `connect-src` 有 `https:` 與 `http:` → 用 `fetch()` 打 API domain **不受 CSP 擋**（但仍受 CORS 限制）。
- `img-src` 有 `https:` → tiles / 圖無問題。
- 這份 CSP 只適用 Tauri build；純 web / Capacitor 不讀 `tauri.conf.json`。

### 3.2 自架 web build（docker nginx）

`docker/nginx.conf:199`（`location / { ... }` 內）：

> ```nginx
> add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https: data: blob: http://127.0.0.1:* http://localhost:* ... ; frame-src 'self' https://accounts.google.com https://www.google.com__GEOLIBRE_CLERK_FRAME_SRC____GEOLIBRE_AUTH0_FRAME_SRC__; worker-src blob: 'self'" always;
> ```

- `frame-src` **只准** `'self'` + Google（+ 兩個由環境變數注入的 Clerk/Auth0 placeholder）。你的 `https://<domain>/viewer/...` → **被擋**。
- `connect-src` 有 `https:`（以及 localhost / 127.0.0.1）→ API domain **可用**（CORS 仍要設）。
- `docker/nginx.conf:137` 是 Jupyter 專用 location 的另一份 CSP，與主 app 無關。
- 這是**自架時可改**的檔案；如果 APK 是自己 bundle assets，根本不經這個 nginx。

### 3.3 `web.geolibre.app`（GitHub Pages）

實際 HTTP response（2026-10-21）：

> ```
> HTTP/2 200
> server: GitHub.com
> content-type: text/html; charset=utf-8
> ...
> (沒有 Content-Security-Policy header)
> ```

`curl -s https://web.geolibre.app/ | grep -iE 'Content-Security-Policy|http-equiv'` → **0 命中**。

- 因此 `web.geolibre.app` **沒有 frame-src 限制**，你的 viewer iframe 不會被它的 CSP 擋。
- 但 HTTPS 頁面 embed `http://` API / viewer 會被 browser 的 **mixed content** 擋；API 必須 HTTPS。
- GitHub Pages 不支援自訂 response header；若你要加 CSP，只能用自己的 reverse proxy / Capacitor 外殼。

### 3.4 Capacitor 外殼

- GeoLibre 的 `tauri.conf.json` 與 `docker/nginx.conf` 都不適用。
- CSP 由**我們的** Capacitor `index.html` meta 或 native layer 決定；如果 bundle GeoLibre web assets，預設沒有 CSP（與 GitHub Pages 一樣）。
- 若負載遠端 `https://web.geolibre.app`，亦沒有 CSP header。
- 這一項對「自己出 APK」是**可控**，不是 blocker。

### 3.5 `frame-ancestors`

在 **app 的兩份 CSP**（`tauri.conf.json:24`、`docker/nginx.conf:199`）內 **未找到** `frame-ancestors`；即不限制自己被誰 iframe。唯一有 `frame-ancestors` 的是 Jupyter 後端設定（`backend/geolibre_server/jupyter_server_config.py:6-8` 的 `Content-Security-Policy: frame-ancestors 'self'` 放寬到包括 `http://tauri.localhost`），與主 app 無關。這與「我們 iframe 別人」無關，但代表反向嵌入不受這些 CSP 限制。


---

## 4. Plugin loader：manifest、integrity、ESM id/name/version 檢查

### 4.1 Manifest URL 必須 HTTPS

`apps/geolibre-desktop/src/components/layout/ManagePluginsDialog.tsx:454-465`：

> ```ts
> 454   const addManifestUrl = useCallback(() => {
> 455     if (getDeploymentPolicy()?.plugins?.sideload === false) return;
> 456     const trimmed = newManifestUrl.trim();
> 457     if (!trimmed) return;
> 458     if (!isAllowedPluginManifestUrl(trimmed)) {
> 459       setSettingsError("Manifest URLs must use HTTPS, or HTTP on localhost, 127.0.0.1, or [::1].");
> 460       return;
> 461     }
> 462     installUrl(trimmed);
> ```

`packages/core/src/project.ts:1747-1757`：

> ```ts
> 1747 export function isAllowedPluginManifestUrl(url: string): boolean {
> 1748   try {
> 1749     const { protocol, hostname } = new URL(url);
> 1750     return (
> 1751       protocol === "https:" ||
> 1752       (protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname))
> 1753     );
> 1754   } catch {
> 1755     return false;
> 1756   }
> 1757 }
> ```

### 4.2 Manifest、entry、style 的抓取與驗證

`apps/geolibre-desktop/src/lib/external-plugins.ts:502-527`：

> ```ts
> 502   const manifestResponse = await fetch(manifestUrl, {
> 503     cache: "no-cache",
> 504     signal,
> 505   });
> ...
> 510   const manifest = (await manifestResponse.json()) as unknown;
> 511   if (!isExternalPluginManifest(manifest)) {
> 512     throw new Error("Plugin manifest is invalid.");
> 513   }
> ...
> 517   const entryUrl = withPluginAssetCacheToken(
> 518     resolvePluginAssetUrl(manifestUrl, manifest.entry),
> 519     cacheToken,
> 520   );
> 521   const styleUrl = manifest.style
> 522     ? withPluginAssetCacheToken(resolvePluginAssetUrl(manifestUrl, manifest.style), cacheToken)
> 523     : null;
> 524   const [entrySource, styleSource] = await Promise.all([
> 525     fetchPluginText(entryUrl, "plugin entry", signal),
> 526     styleUrl ? fetchPluginText(styleUrl, "plugin style", signal) : Promise.resolve(null),
> 527   ]);
> ```

`apps/geolibre-desktop/src/lib/plugin-archive-unpack.ts:56-70`（manifest 只認這些欄位）：

> ```ts
> 56 export function isExternalPluginManifest(value: unknown): value is GeoLibreExternalPluginManifest {
> 57   if (!value || typeof value !== "object") return false;
> 58   const manifest = value as Partial<GeoLibreExternalPluginManifest>;
> 59   return (
> 60     isRequiredManifestString(manifest.id) &&
> 61     isRequiredManifestString(manifest.name) &&
> 62     isRequiredManifestString(manifest.version) &&
> 63     isRequiredManifestString(manifest.entry) &&
> 64     (manifest.entry.endsWith(".js") || manifest.entry.endsWith(".mjs")) &&
> 65     (manifest.description === undefined || typeof manifest.description === "string") &&
> 66     (manifest.style === undefined ||
> 67       (typeof manifest.style === "string" && manifest.style.endsWith(".css"))) &&
> 68     (manifest.activeByDefault === undefined || typeof manifest.activeByDefault === "boolean") &&
> 69     (manifest.engines === undefined || isPluginEngineList(manifest.engines))
> 70   );
> ```

- **未找到** `minGeoLibreVersion` 在 `isExternalPluginManifest` 或 `plugin-archive-unpack.ts`；manifest 多出的 key 不會被檢查（type guard 只檢查上面欄位）。
- `entry` 必須 `.js` / `.mjs`；`style` 必須 `.css`（`plugin-archive-unpack.ts:64-67`）。

### 4.3 ESM export 與 id/name/version 檢查

`apps/geolibre-desktop/src/lib/external-plugins.ts:607-640`：

> ```ts
> 607 async function importExternalPlugin(bundle: ExternalPluginBundle): Promise<GeoLibrePlugin> {
> 608   // Plugin code can call any Tauri command; saved credentials must be unreadable first (#2858).
> 609   await sealSecureCredentialReads();
> 610   const moduleUrl = URL.createObjectURL(
> 611     new Blob([bundle.entrySource], { type: "text/javascript" }),
> 612   );
> 613
> 614   try {
> 615     const module = (await import(/* @vite-ignore */ moduleUrl)) as {
> 616       default?: unknown;
> 617       plugin?: unknown;
> 618     };
> 619     const candidate = module.default ?? module.plugin;
> 620     if (!isGeoLibrePlugin(candidate)) {
> 621       throw new Error("Entry must export a GeoLibrePlugin as default or plugin.");
> 622     }
> 623     validateManifestMatchesPlugin(bundle.manifest, candidate);
> 624     if (candidate.activeByDefault) {
> 625       throw new Error("External plugins cannot use activeByDefault.");
> 626     }
> ```

`apps/geolibre-desktop/src/lib/external-plugins.ts:654-667`：

> ```ts
> 654 function validateManifestMatchesPlugin(
> 655   manifest: GeoLibreExternalPluginManifest,
> 656   plugin: GeoLibrePlugin,
> 657 ): void {
> 658   if (plugin.id !== manifest.id) {
> 659     throw new Error("Exported plugin id does not match plugin.json.");
> 660   }
> 661   if (plugin.name !== manifest.name) {
> 662     throw new Error("Exported plugin name does not match plugin.json.");
> 663   }
> 664   if (plugin.version !== manifest.version) {
> 665     throw new Error("Exported plugin version does not match plugin.json.");
> 666   }
> 667 }
> ```

- 這是 **host-side** 檢查，與 Tauri 無關；純 web / Capacitor 一樣會執行。
- 你的 plugin 必須 export default 或 named `plugin`，且 `id/name/version` 與 `plugin.json` 完全一致；`activeByDefault` 在 exported object 上會 throw。


### 4.4 Integrity pin（URL plugin）

`apps/geolibre-desktop/src/lib/plugin-integrity.ts:29-47`（hash 的組成）：

> ```ts
> 29 export async function computePluginBundleHash(bundle: PluginBundleForHashing): Promise<string> {
> 30   // Hash entry and style independently, then hash the two digests together --
> ...
> 38   const [entryDigest, styleDigest] = await Promise.all([
> 39     crypto.subtle.digest("SHA-256", encoder.encode(bundle.entrySource)),
> 40     crypto.subtle.digest("SHA-256", encoder.encode(bundle.styleSource ?? "")),
> 41   ]);
> 42   const combined = new Uint8Array([...new Uint8Array(entryDigest), ...new Uint8Array(styleDigest)]);
> 43   const digest = await crypto.subtle.digest("SHA-256", combined);
> ```

`apps/geolibre-desktop/src/lib/plugin-integrity.ts:107-111`：

> ```ts
> 107 export function pinPluginBundle(url: string, hash: string, version?: string): void {
> 108   const pins = readPins();
> 109   pins[url] = version === undefined ? { hash } : { hash, version };
> 110   writePins(pins);
> 111 }
> ```

`apps/geolibre-desktop/src/lib/plugin-integrity.ts:126-138, 154-180`：

> ```ts
> 126 export type PluginBundleIntegrity =
> 127   /** No prior pin; pinned now and allowed (trust on first use). */
> 128   | { status: "pinned-first-use" }
> 129   /** Hash matches the pin; allowed. */
> 130   | { status: "unchanged" }
> 131   /** Hash differs from the pin; blocked until the user reloads it. */
> 132   | {
> 133       status: "changed";
> ...
> 154 export async function verifyPluginBundleIntegrity(
> ...
> 161   const pin = readPins()[url];
> 162   if (!pin) {
> 163     pinPluginBundle(url, currentHash, version);
> 164     return { status: "pinned-first-use" };
> 165   }
> 166   if (pin.hash === currentHash) {
> ...
> 174     return { status: "unchanged" };
> 175   }
> 176   return {
> 177     status: "changed",
> 178     pinnedHash: pin.hash,
> 179     currentHash,
> 180     pinnedVersion: pin.version ?? null,
> ```

`apps/geolibre-desktop/src/lib/external-plugins.ts:405-426`（changed 就唔載入）：

> ```ts
> 405   const integrity = await verifyPluginBundleIntegrity(
> 406     manifestUrls[index],
> 407     bundle,
> 408     bundle.manifest.version,
> 409     bundleHash,
> 410   );
> 411   if (integrity.status === "changed") {
> ...
> 423       message: heldBackPluginMessage(bundle.sourceUrl ?? manifestUrls[index], heldBack),
> 424     });
> 425     continue;
> 426   }
> ```

- Pin 存在 `localStorage`（`plugin-integrity.ts:55-58` 讀 `PIN_STORAGE_KEY`），所以純 web / Capacitor 一樣有 pin；換一個 WebView profile 就是新 pin。
- 只要 `plugin.js` 或 `style.css` 內容一變（即使版本號有 bump），舊 pin 會回 `changed`，該 plugin 不會自動載入；要 user 明確 Update／重裝。
- 大小上限：`plugin-archive-unpack.ts:21` `export const MAX_PLUGIN_ASSET_BYTES = 50 * 1024 * 1024;`；URL fetch 亦用同一個上限（`external-plugins.ts:565-567`：`exceeds the 50 MB size limit.`）。


---

## 5. File input、camera、getUserMedia、大檔上載限制

### 5.1 相機與 getUserMedia

- **相機 API：未找到。** `grep -rn -iE 'getUserMedia|mediaDevices|facingMode|video: *true|capture='` 的結果只有：
  - `apps/geolibre-desktop/src/hooks/useVoiceCommands.ts:229` 的**麥克風** `getUserMedia`；
  - `apps/geolibre-desktop/src/components/layout/FieldCollectionDialog.tsx:1532` 的**註解**提到 `capture="environment"`，但實際 input 沒有這個 attribute。
- 沒有 `getUserMedia({ video: true })`、沒有 `ImageCapture`、沒有 camera preview／拍照 API。

`apps/geolibre-desktop/src/hooks/useVoiceCommands.ts:228-233`：

> ```ts
> 228       requestStream: () =>
> 229         navigator.mediaDevices.getUserMedia({
> 230           // The meter only needs energy, so ask for the cleanest stream the
> 231           // browser will give: room tone would otherwise animate it constantly.
> 232           audio: { echoCancellation: true, noiseSuppression: true },
> 233         }),
> ```

- 這是 **audio-only**；在 Capacitor 要 `RECORD_AUDIO` permission，且 WebView 要處理 `onPermissionRequest`。

`apps/geolibre-desktop/src/components/layout/FieldCollectionDialog.tsx:1531-1541`：

> ```tsx
> 1531             {/* No `capture` attribute: let the user pick existing photos or take
> 1532                 a new one (capture="environment" forces the camera on iOS). */}
> 1533             <input
> 1534               ref={photoInputRef}
> 1535               id="fc-photo"
> 1536               type="file"
> 1537               accept="image/*"
> 1538               multiple
> 1539               className="hidden"
> 1540               onChange={onPhotos}
> 1541             />
> ```

- 這是標準 file input；Android 上是否出現「相機」選項，取決於 OS／WebView 的 chooser，不是 GeoLibre 的相機 API。
- 沒有多張環繞拍攝、沒有 EXIF／pose 收集、沒有即時 preview。

### 5.2 相片／檔案大小上限（硬編碼）

| 用途 | 位置 | 原文 | 上限 |
|---|---|---|---|
| Field collection 每張相 | `apps/geolibre-desktop/src/lib/field-collection.ts:84` | `export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;` | **2 MB**（註解 L82：`Cap each embedded data URL`） |
| Georeferencer 來源圖 | `apps/geolibre-desktop/src/components/layout/GeoreferencerDialog.tsx:73` | `const MAX_IMAGE_BYTES = 8 * 1024 * 1024;` | **8 MB**（L68-71：inline base64，~4/3 膨脹） |
| 本地 glTF/GLB | `apps/geolibre-desktop/src/lib/local-gltf.ts:70` | `export const MAX_LOCAL_GLTF_BYTES = 24 * 1024 * 1024;` | **24 MB** |
| Plugin entry/style（zip 或 URL） | `apps/geolibre-desktop/src/lib/plugin-archive-unpack.ts:21` | `export const MAX_PLUGIN_ASSET_BYTES = 50 * 1024 * 1024;` | **50 MB** |
| Project embed 警告 | `apps/geolibre-desktop/src/hooks/useProjectFileActions.ts:147` | `export const LARGE_EMBED_WARNING_BYTES = 50 * 1024 * 1024;` | **50 MB**（警告，不是硬擋） |
| Language pack | `apps/geolibre-desktop/src/lib/language-pack.ts:14` | `export const LANGUAGE_PACK_MAX_BYTES = 5 * 1024 * 1024;` | **5 MB** |
| Service library import | `apps/geolibre-desktop/src/components/layout/add-data/ServiceLibrarySection.tsx:34` | `const MAX_IMPORT_BYTES = 5 * 1024 * 1024;` | **5 MB** |
| Dev proxy body | `apps/geolibre-desktop/vite-proxy-guard.ts:21` | `export const PROXY_MAX_BODY_BYTES = 50 * 1024 * 1024; // 50 MB` | **50 MB**（只限 Vite dev proxy，不是 production server） |

- `importTextFile` 的 web caveat：`packages/plugins/src/types.ts:1018-1021`
  > ```ts
  > 1018   * Web-only caveat: browsers do not fire a cancel event for `<input
  > 1019   * type="file">`, so on the web the returned promise stays pending if the
  > 1020   * user dismisses the dialog without choosing a file. Under Tauri (the
  > 1021   * primary desktop target) cancel resolves to null as expected.
  > ```
  `file-dialogs.ts:261-264` 有自己加 `cancel` listener 解決，但 plugin 直接用 `app.importTextFile` 仍會遇到這個 caveat。


### 5.3 大檔上載

- **未找到**通用的「上載檔案到 server」endpoint 或全局限額。GeoLibre 主要是 local-first：檔案經 browser File API 讀入，或由 URL fetch。
- 找到的 `FormData` 上載只用於特定功能，不是通用上載：
  - `packages/plugins/src/plugins/arcgis-attachments.ts:309-310`
    > ```ts
    > 309 function uploadForm(file: Blob, fileName: string, token: string | undefined): FormData {
    > 310   const form = new FormData();
    > ```
  - `packages/processing/src/sidecar-client.ts:1304`：`const form = new FormData();`（送去本地 sidecar）。
- 這兩個 path **未找到** size guard；它們不是我們的 API，也不應重用。
- 對我們的用法：42.9MB PLY 之類的大檔，GeoLibre 本身沒有「上載」概念；應由我們的 API 以 URL / Range / 分塊處理，plugin 只負責顯示進度。

### 5.4 Android permissions

- pinned repo 內只有一個 `AndroidManifest.xml`：`apps/geolibre-desktop/src-tauri/vendor/tauri-plugin-geolocation/android/src/main/AndroidManifest.xml:3-4`
  > ```xml
  > 3     <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  > 4     <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  > ```
- **主 AndroidManifest 未找到**：`find . -name AndroidManifest.xml -not -path '*/node_modules/*'` 只找到 vendor 這一個；Tauri 的 `src-tauri/gen/android` 沒有 commit（build 時 generate）。
- `CAMERA`、`RECORD_AUDIO`、`READ_MEDIA_IMAGES` 在 pinned repo **未找到**。
- 若用 Capacitor 外殼，這些 permission 要在**我們的** `AndroidManifest.xml` 加；GeoLibre 不會提供。

### 5.5 「影相 → 出 model」能力

- `grep -rn -iE 'photogrammetr|structure from motion|\bSfM\b|colmap|reality capture'` 只命中：
  - `docs/demos.md:10`（**消費**已有的 photogrammetry 3D Tiles）：
    > ```md
    > 10 Photogrammetry and mesh datasets stream in as [3D Tiles](user-guide/adding-data.md)
    > ```
  - `packages/core/src/cesium-ion.ts:69` 的 Cesium Ion asset 名稱 `"Melbourne Photogrammetry"`；
  - `apps/geolibre-desktop/src/lib/whitebox-distance-params.ts:35` 的註解（focal length 參數）。
- **沒有** SfM / COLMAP / 多視角重建 / mesh generation 的實作；**未找到**任何 capture → model pipeline。
- 因此：GeoLibre 可以做「顯示已完成的 model / 3D Tiles / 點雲 / 樹木圖層」，但**不能**做 RealityScan / Polycam 的拍攝重建。

---

## 6. 三級分類：Android 外殼 A0 blocker / 可以繞過 / 無影響

> 定義：**A0 blocker** = 令「自己出 APK + 達到目標產品體驗」不可行，且唔可以靠設定或小改避開；**可以繞過** = 有替代方案或要自己補模組；**無影響** = 照用即可。

### 6.1 Android 外殼本身

| 項目 | 級別 | 依據 / 行動 |
|---|---|---|
| LICENSE 重新打包 APK | **無影響** | MIT 明確允許 distribute/sublicense/sell（`LICENSE:7-9`）；保留 `LICENSE:12-13` notice。品牌名/logo 未授權（trademark 未找到）。 |
| Tauri API 在 Capacitor | **可以繞過** | `isTauri()` 認 `__TAURI_INTERNALS__`（`is-tauri.ts:8`），Capacitor 無 → false；file/geolocation 有 browser fallback；sidecar/keychain/nativeFetch 要自己補或不用。 |
| Plugin loader | **無影響** | manifest/ESM/integrity 全部 host-side JS，與 Tauri 無關（§4）。 |
| CSP（自己 bundle assets / 自己 shell） | **無影響** | 我們控制 Capacitor CSP；GeoLibre 的 `tauri.conf.json` / nginx CSP 不適用（§3.4）。 |
| CSP（自架 docker nginx） | **可以繞過** | `frame-src` 擋外部 viewer（`docker/nginx.conf:199`）；改 nginx 加 domain 或用自己 reverse proxy。 |
| CSP（載入 web.geolibre.app） | **無影響** | 實際 header 無 CSP（§3.3）；viewer 不被擋，但 API 必須 HTTPS。 |
| `openExternalUrl` 外開 | **可以繞過** | web fallback 是 `window.open`（`open-external.ts:30`）；Capacitor 要改用 `@capacitor/browser` 或自訂 bridge，不能假設 window.open 開到。 |
| 相機 / getUserMedia | **可以繞過（同一 APK 加原生模組）** | GeoLibre 沒有 camera API、沒有 video getUserMedia；只有 audio 麥克風（`useVoiceCommands.ts:229`）。但外殼是我們的，可以用 Capacitor 原生 plugin / CameraX / ARCore 在同一個 app 內做拍攝畫面。 |
| 影相 → model（SfM） | **可以繞過（後端負責）** | GeoLibre 未找到 photogrammetry 實作；只消費 3D Tiles（`docs/demos.md:10`）。photogrammetry 本來就是後端工作，GeoLibre 不需要負責。 |
| Field collection 2MB 相片上限 | **可以繞過** | 不要用 field collection；自己影相／上載去我們的 pipeline（`field-collection.ts:84`）。 |
| Plugin / asset 50MB 上限 | **可以繞過** | 大 model 放我們的 API / CDN，用 URL + Range；plugin code 保持 <50MB（`plugin-archive-unpack.ts:21`）。 |
| `apps/map-plugin` 審核 | **A0 blocker（未清）** | **未找到**（本地與 `ykwanstudy-lab` 公開 repo 都沒有）。未審前唔可以當 shell 完全無 blocker；要提供正確 repo / branch。 |

### 6.2 產品層結論

- **只做 Android 外殼：就本次五項審計，冇 shell-level A0 blocker。** 你可以用 GeoLibre web build + Capacitor 出 APK，地圖、圖層、plugin、tree info overlay 都可行；Tauri-only 功能會缺席但不影響核心。（`apps/map-plugin` 未找到，plugin 自身有冇用 Tauri-only API 仍屬審計缺口。）
- **要 RealityScan/Polycam 式「影相 → 出 model」：同一個 APK 可以做到，唔需要拆產品。** GeoLibre 本身沒有 capture / photogrammetry pipeline，這是事實；但外殼是我們的，可以在同一個 Capacitor app 內加原生拍攝模組（CameraX + ARCore），拍完交後端 SfM。後端用 **COLMAP（new BSD）**；**OpenMVS 是 AGPL-3.0，按既定 hosted 規則不可用**（見 §7.1 更正）。
- **要 Google Maps 底圖 + tree info：Google 圖像有，但不是 Google Maps JS API。** pinned repo 有 `Google Maps Satellite`、`Satellite with Labels`、`Roadmap`、`Contour` 四個 imagery（`packages/core/src/cesium-imagery.ts:43-61`），全部是 **Cesium Ion `assetId`**；`google.maps.Map` / `maps.google.com/maps/api/js` / `@googlemaps` **未找到**。要真正的 Google Maps JS API（vector map、原生 marker/info window）是另一個整合；要 Google 圖像 + tree overlay，用 Cesium Ion 路線即可，但需要 Cesium Ion token（Google Photorealistic 3D Tiles 另需 Google Maps API key，`packages/plugins/src/plugins/maplibre-3d-tiles.ts:1213`）。


---

## 7. 更正與 A0 spike（單一 APK 方案）

### 7.1 更正：OpenMVS 不可用，COLMAP 才是 hosted 選項

- `cdcseacave/openMVS` 的 GitHub license API 回 **`AGPL-3.0`**；`LICENSE` 開頭是 `GNU AFFERO GENERAL PUBLIC LICENSE Version 3`。按你既定「hosted 環境不可用 AGPL」規則，**OpenMVS 不可用**。
- `colmap/colmap` 的 `LICENSE:1-2` 原文：
  > `The COLMAP library is licensed under the new BSD license. Note that this text refers only to the license for COLMAP itself, independent of its dependencies, which are separately licensed.`
- 所以 §6.2 已改為 **COLMAP（new BSD）**，不再建議 OpenMVS。若用 RealityScan，先驗 EULA（未在本 audit 範圍）。

### 7.2 Plugin 打包入 APK：GeoLibre v3.4.0 官方支援，而且豁免 integrity pin

`docs/plugin-api.md:1441-1459`：

> ```md
> 1441 To ship an external plugin as part of GeoLibre — loaded automatically, with no Settings entry and no manifest URL — drop its built bundle into the Vite public directory, one folder per plugin id:
> ...
> 1450 ... The `bundledPlugins()` Vite plugin ... scans `public/plugins/` at build and dev-server start, exposes the discovered manifest paths through the `virtual:bundled-plugins` module, and `usePlugins.ts` loads them through the normal external-plugin path (fetch → blob import → register). Discovery happens at build time ...
> ...
> 1456 Bundled manifest URLs are injected at load time rather than stored in Settings. Bundled plugins are eligible to load without being listed in `allowed` or permitting sideload, but an id in `blocked` still prevents loading.
> ```

`apps/geolibre-desktop/src/lib/external-plugins.ts:381-383`：

> ```ts
> 381       // Bundled drop-ins are exempt from the pin; see `bundledManifestUrls` in
> 382       // loadExternalPlugins for why. Everything else still goes through it.
> 383       if (!bundledUrls.has(manifestUrls[index])) {
> ```

`apps/geolibre-desktop/src/hooks/usePlugins.ts:895-908`：

> ```ts
> 895 // tauri://localhost, allowed by `connect-src 'self'`). These are injected at
> 896 // load time rather than stored in Settings, so a baked-in plugin always loads
> 897 // and cannot be removed by the user. ...
> 899 export function bundledPluginManifestUrls(): string[] {
> ...
> 906   return bundledPluginManifestPaths.map(
> 907     (path) => new URL(path, new URL(base, window.location.href)).href,
> 908   );
> ```

`docs/plugin-api.md:1463-1466`：

> ```md
> 1463 A bundled drop-in's `plugin.json` may additionally set `"activeByDefault": true`
> 1464 to activate the plugin on startup. Saved plugin state still wins ...
> 1466 The flag is honored **only** for bundled drop-ins; it does not bypass a blocked
> ```

**結論**：把 `apps/map-plugin` 的 build 產物放到 `apps/geolibre-desktop/public/plugins/<plugin-id>/`（`plugin.json` + entry + optional style），再 `npm run build`；`bundledPlugins()` 會在 build time 掃到，`usePlugins.ts` 自動載入。**不需要 manifest URL、不需要 integrity pin、不需要客戶重裝 plugin**；plugin 更新 = 重新出 APK。`blocked` 仍然有效（部署 policy），但 `allowed` / `sideload` 不適用。

### 7.3 `window.Capacitor` 對 plugin 是否可見（static evidence）

Capacitor 的 native layer 直接把 global 注入主 WebView：

- Android `android/capacitor/src/main/java/com/getcapacitor/JSExport.java:20-22`：
  > ```java
  > 20     public static String getGlobalJS(Context context, boolean loggingEnabled, boolean isDebug) {
  > 21         return "window.Capacitor = { DEBUG: " + isDebug + ", isLoggingEnabled: " + loggingEnabled + ", Plugins: {} };";
  > 22     }
  > ```
- iOS `ios/Capacitor/Capacitor/JSExport.swift:19`：
  > ```swift
  > 19         let data = "window.Capacitor = { DEBUG: \(isDebug), isLoggingEnabled: \(loggingEnabled), Plugins: {} }; window.WEBVIEW_SERVER_URL = '\(localUrl)';"
  > ```

而 GeoLibre 的 external plugin 是 `import(moduleUrl)` 在同一個 window 內執行（`external-plugins.ts:610-615`，見 §4.3），不是 iframe、不是新 WebView。**靜態證據強烈支持 `window.Capacitor` 可見**；但這仍是推斷，未在中階 Android 機實測。A0 spike 必須用一個 Toast plugin 證明 bridge 通，失敗才考慮 fork GeoLibre 加 hook。

> 以上 Capacitor 源碼取自 `ionic-team/capacitor` default branch（2026-10-21），不是特定 release；你哋 pin 的 Capacitor 版本要再用同一段 `JSExport` 核一次。

### 7.4 URL GLB 有冇 24MB 限制？

- `MAX_LOCAL_GLTF_BYTES = 24 * 1024 * 1024` 只用在 local file → data URL：`apps/geolibre-desktop/src/lib/local-gltf.ts:70`
  > `export const MAX_LOCAL_GLTF_BYTES = 24 * 1024 * 1024;`
  > `74   if (data.byteLength > MAX_LOCAL_GLTF_BYTES) throw new Error("modelTooLarge");`
- URL 路徑是 `DeckVizSource.tsx:567-588` 的 `Input`（`toolbar.scenegraph.modelUrl`），直接寫入 `deckVizModelUrl`，**冇看到 size check**；sample 亦直接指向遠端 GLB：`apps/geolibre-desktop/src/lib/model-samples.ts:21`
  > `modelUrl: "https://data.source.coop/giswqs/opengeos/shanghai-3d-model.glb",`
- `MAX_MODEL_GLB_BYTES = 24 * 1024 * 1024` 另一處只在 KML inline model：`apps/geolibre-desktop/src/lib/file-io/kml-kmz.ts:525`。
- **結論：未找到 URL GLB 的 24MB 硬上限**；24MB 只適用 local embed / KML inline。URL GLB 仍受 WebView 記憶體同 deck.gl 解碼能力限制，要實測（尤其 4G + 中階機）。

### 7.5 A0 spike（1–2 日）成功標準

1. **補審 plugin**：提供 `apps/map-plugin` 實際 repo / branch；如果 plugin 有用 `app.nativeFetch` / `window.open` / `pickLocalDirectoryFiles`，在 Capacitor 要改 optional-chain 或 bridge。
2. **Bundled plugin build**：把 plugin build 產物放入 `public/plugins/<id>/`，`npm run build`，確認 `virtual:bundled-plugins` 有列出、app 啟動自動載入、Settings 冇 manifest URL、冇 integrity pin。
3. **Capacitor bridge**：同一個 plugin 內呼叫一個自訂 Capacitor plugin（例如 Toast），證明 `window.Capacitor` 可見；同時測地圖流暢度、plugin 載入、Android back button。
4. **URL GLB**：用一棵真實樹 GLB（>24MB 及 <24MB 各一）經 URL 載入，記錄記憶體 / 首次 render 時間；如果 OOM，改為後端 decimated LOD 或 3D Tiles。
5. **後端**：COLMAP（new BSD）；**不要用 OpenMVS（AGPL-3.0）**。引擎實測（P0）仍然是「直接出 model」的關鍵，換外殼不會令處理變快。

> A0 spike 未過之前，`window.Capacitor` 仍然係「static evidence strongly supports, device-unverified」。不要把推斷當事實。



---

## Appendix A — `@tauri-apps/*` import 檔案清單（41 個檔案；61 條 grep 命中）

> 路徑相對於 `apps/geolibre-desktop/src/`（`packages/plugins/...` 例外）。`src-tauri/vendor` 已排除。同一檔案多條 import 以行號列出；multiline import 以起始行表示。

| 檔案 | 行號 |
|---|---|
| `components/layout/add-data/sources/GdbSource.tsx` | 13, 14 |
| `hooks/desktop-shell/useFileDrop.ts` | 126, 191 |
| `hooks/usePlugins.ts` | 137, 138 |
| `hooks/useWindowCloseGuard.ts` | 24, 63 |
| `lib/admin-profile.ts` | 11 |
| `lib/app-api.ts` | 45, 46, 47 |
| `lib/arcgis-fetch.ts` | 1, 151 |
| `lib/arcgis-oauth.ts` | 393 |
| `lib/assistant/os-env.ts` | 61 |
| `lib/assistant/typesafe-fetch.ts` | 40 |
| `lib/credential-store.ts` | 11 |
| `lib/deployment-policy.ts` | 9 |
| `lib/external-plugins.ts` | 7 |
| `lib/file-io/file-dialogs.ts` | 7, 8 |
| `lib/file-io/local-fs.ts` | 6, 7 |
| `lib/file-io/project-files.ts` | 7, 8, 9 |
| `lib/file-io/raster-photo-files.ts` | 6, 7, 8 |
| `lib/file-io/vector-loader.ts` | 8, 9, 10 |
| `lib/file-io/vector-text-formats.ts` | 7 |
| `lib/geocoding-fetch.ts` | 57 |
| `lib/geolens-fetch.ts` | 41 |
| `lib/geolocation.ts` | 21, 115, 134, 163 |
| `lib/jupyter.ts` | 1 |
| `lib/martin.ts` | 1 |
| `lib/mbtiles.ts` | 2 |
| `lib/native-coordinate-open.ts` | 16 |
| `lib/native-http.ts` | 14 |
| `lib/native-project-open.ts` | 26, 60 |
| `lib/native-share-auth.ts` | 180 |
| `lib/obia/obia-native.ts` | 27 |
| `lib/open-external.ts` | 1 |
| `lib/plugin-native-fetch.ts` | 13 |
| `lib/remote-download.ts` | 9 |
| `lib/s3-signer.ts` | 18 |
| `lib/share-fetch.ts` | 7, 99 |
| `lib/share-oauth.ts` | 577 |
| `lib/sidecar-fetch.ts` | 75 |
| `lib/sidecar.ts` | 1 |
| `lib/xyz-url.ts` | 2 |
| `lib/zarr-directory-picker.ts` | 16, 17 |
| `packages/plugins/src/plugins/earth-engine-auth.ts` | 4, 348, 397 |

> 註：上表覆蓋 41 個檔案；multiline import（例如 `geolocation.ts:21`）以起始行表示。若要逐行原文，執行 Appendix C 的 grep。

---

## Appendix B — 「未找到」清單（避免誤解）

| 項目 | 狀態 | 搜尋方式 |
|---|---|---|
| `apps/map-plugin` / 其 `plugin.js`、`plugin.json` | **未找到** | `/workspace` 無 `apps/`；`find / -maxdepth 6 -type d -name map-plugin` 無結果；`gh repo list ykwanstudy-lab` 無此 repo |
| `window.__TAURI__` | **未找到** | `grep -rn 'window.__TAURI__' apps packages` 0 命中；只有 `__TAURI_INTERNALS__` |
| `minGeoLibreVersion` 在 manifest / `plugin-archive-unpack.ts` | **未找到**（不是 manifest 欄位） | 它只出現在 registry entry：`plugin-registry.ts:23,284`、`ManagePluginsDialog.tsx:671`、`usePluginDeepLink.ts:224`；`isExternalPluginManifest` 不會讀它 |
| app CSP 的 `frame-ancestors` | **未找到** | 只有 Jupyter backend `jupyter_server_config.py` 有（非主 app） |
| 相機 API / `getUserMedia({video:true})` / `ImageCapture` / `capture=` attribute | **未找到** | 只有 `useVoiceCommands.ts:229` audio；`FieldCollectionDialog.tsx:1532` 是註解 |
| Photogrammetry / SfM / COLMAP / OpenMVS | **未找到** | 只命中 3D Tiles 消費、Cesium Ion asset 名稱、Whitebox 參數註解 |
| 通用大檔上載 endpoint / 全域 size cap | **未找到** | 只有特定 `FormData`（ArcGIS attachments / sidecar）與 §5.2 的檔案上限 |
| 主 `AndroidManifest.xml` / `CAMERA` / `RECORD_AUDIO` | **未找到** | 只有 vendor geolocation manifest 的 location 權限 |
| Trademark policy / `NOTICE` | **未找到** | `grep -rni trademark` 0 命中；`ls` 只有 `LICENSE` |
| Google Maps JS API（`google.maps.Map` / `maps/api/js`） | **未找到** | 只有 Cesium Ion 的 Google imagery、Google geocoding/street view key |
| `geolibre-web` 自訂 CSP header / `_headers` | **未找到** | `curl -sI https://web.geolibre.app/` 無 CSP；`contents/_headers` 404 |

---

## Appendix C — 重現指令

```bash
# pinned source
git clone --depth 1 --branch v3.4.0 https://github.com/opengeos/GeoLibre.git /tmp/gl340
cd /tmp/gl340 && git rev-parse HEAD   # 31264e594f6bea72935a736a9d7aaa165c4c6294

# Tauri API inventory
grep -rn --include=*.ts --include=*.tsx -E 'import .*"@tauri-apps|await import\("@tauri-apps' apps packages | grep -v vendor

# CSP
python3 -c "import json;print(json.load(open('apps/geolibre-desktop/src-tauri/tauri.conf.json'))['app']['security']['csp'])"
grep -n 'Content-Security-Policy' docker/nginx.conf

# camera / file input
grep -rn -E 'getUserMedia|capture=|type="file"' --include=*.ts --include=*.tsx apps packages

# photogrammetry
grep -rn -iE 'photogrammetr|structure from motion|\bSfM\b|colmap|reality capture' .
```

