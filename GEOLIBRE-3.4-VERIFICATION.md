# GeoLibre v3.4 對照檢查報告（2026-10-21）

核對對象：`opengeos/GeoLibre`、`opengeos/geolibre-plugins`、官方 docs、App Store / Google Play 列表。
目的：逐項驗證《Arbotic Twin — Mobile App 計劃（Plan A）》入面關於 GeoLibre 嘅事實假設。

---

## 0. TL;DR

- 計劃嘅**主幹成立**：GeoLibre 真身存在（MIT、Tauri v2 mobile）、iOS/Android 都上咗架、兩邊都係 **3.4.0（2026-10-12）**、mobile build 有 Manage Plugins、可以用 manual manifest URL 裝外部 plugin、manifest 必須 HTTPS、官方有 plugin registry 同 Plugin API docs。
- 但有 **6 個位講錯或講漏**，其中 **2 個足以令 mobile demo 直接失敗**：
  1. **`frame-src` CSP 會 block 你計劃入面 `https://<domain>/viewer/...` 嘅 iframe**（desktop 同 mobile 共用 `tauri.conf.json`；web 測唔到）。
  2. **A3 用 `location.origin` 做 API base 係錯**：plugin 係以 blob module 喺 host app 內執行，`location.origin` 永遠係 GeoLibre app origin（`tauri://localhost` 等），唔係你 host plugin 嘅 domain。
- 另外：`minGeoLibreVersion` 唔屬 `plugin.json`（屬 registry entry，manual URL 完全冇版本閘）；`v2.8.1` 根本唔存在；plugin 內容一改（URL 唔變）會被 **integrity pin** held back；`startup project` 喺 mobile 唔會自動開。

---

## 1. 對得返嘅項目（有證據）

| 計劃講法 | 判定 | 證據 |
|---|---|---|
| `opengeos/GeoLibre` repo、MIT、web/desktop/mobile | ✅ | repo API：license MIT、8,084 stars、description 明講 "runs in the web browser, on the desktop, on mobile, and inside Jupyter notebooks" |
| 最新 release **v3.4.0 = Oct 12** | ✅ 準確 | `v3.4.0` published `2026-10-11T23:31:31Z`（HKT 10-12 07:31） |
| App Store 係 **GeoLibre by Qiusheng Wu**、3.4.0 | ✅ 準確 | iTunes lookup（id `6796039674`）：`trackName=GeoLibre`、`sellerName=Qiusheng Wu`、`version=3.4.0`、`currentVersionReleaseDate=2026-10-12T15:17:26Z`、`minimumOsVersion=15.0`、bundle `org.geolibre.app` |
| Google Play 都有 | ✅ | `play.google.com/store/apps/details?id=org.geolibre.app`，頁面顯示 `3.4.0`、`Updated on Oct 12, 2026` |
| Tauri v2 mobile（同一個 React codebase） | ✅ | `docs/ios.md` / `docs/android.md` 第一段；`src-tauri/Cargo.toml`: `tauri = { version = "2" }` |
| Mobile 有 plugins（唔止 desktop） | ✅ | `docs/ios.md`: "ships the full map workspace … and plugins"；`docs/android.md` 同樣 |
| 手機有 **Manage Plugins**（唔係 Mac App Store 特別版） | ✅（有附帶條件） | `TopToolbar.tsx`：`onOpenManagePlugins={IS_MAS_BUILD ? undefined : ...}`，而 `IS_MAS_BUILD` 只由 `GEOLIBRE_MAS_BUILD=1`（Mac App Store build）設定。iOS App Store / Android 唔受影响。整個 surface 另受 `deploymentCapabilities.has("plugins:install")` 控制，預設全開 |
| Manual manifest URL 安裝 | ✅ | `ManagePluginsDialog.tsx` Settings tab 有 "Plugin manifest URL" 輸入；`isAllowedPluginManifestUrl` 限制 HTTPS（或 localhost / 127.0.0.1 / [::1]） |
| Manifest 必須 HTTPS | ✅ | `geolibre-plugins/docs/develop.md`: "Manifest URLs must be HTTPS (or HTTP on localhost)"；`docs/user-guide/plugins.md` 同樣 |
| `geolibre-plugins` 係 curated registry | ✅ | repo 存在（MIT），`registry/*.json` + `schemas/registry-entry.schema.json` + `examples/sample/` |
| 官方 docs 三頁存在 | ✅ | `docs/plugin-api.md`（Plugin API）、`docs/user-guide/plugins.md`（Plugins & Marketplace）、`docs/deployment-policy.md` + `docs/deployment-capabilities.md`（Deployment policy） |
| `web.geolibre.app` 跟 main 最新 | ✅（部署層面） | `.github/workflows/web-deploy.yml`：`on.push.branches:[main]` + `workflow_dispatch`，每次 push main 都重新發佈 |
| Store app 版本 ≠ web 版本，A4 要對住實際 store 版本 | ✅ 判斷正確 | 兩邊現時都 3.4.0，但 store 要經審批，日後會落後 |
| 「唔使 App Store/Play 審批」 | ✅ | plugin 係 runtime 由 manifest URL 載入，唔涉及上架 |


---

## 2. 要改嘅地方（6 項）

### 2.1 `minGeoLibreVersion` 唔係 `plugin.json` 欄位（A2 要改）

- `plugin-manifest.schema.json` 只要求 `id / name / version / entry`，可選 `style / description / author / homepage / engines`；**冇** `minGeoLibreVersion`。
- 官方 sample `examples/sample/plugin.json` 亦冇呢個欄位。
- 真正位置係 **registry entry**（`registry/<id>.json` → `https://plugins.geolibre.app/registry.json`），由 marketplace 安裝時用：
  ```ts
  const compatible = satisfiesMinVersion(APP_VERSION, entry.minGeoLibreVersion);
  ```
  （`ManagePluginsDialog.tsx` L671；`plugin-registry.ts` `satisfiesMinVersion`）
- 你手動貼 manifest URL 安裝時，**完全唔會做版本檢查**（根本冇 registry entry 可比）。
- 將 `minGeoLibreVersion` 塞入 `plugin.json` 唔會出錯（`isExternalPluginManifest` 只檢查已知欄位，extra key 被忽略），但**零作用**。
- 要真正有 compatibility gate，只有兩條路：
  1. 將 plugin 提交去 `opengeos/geolibre-plugins` registry（PR，要 review + bundle hash）；或
  2. 自 host 一個 registry，再用 deployment `plugins.registryUrl` 指過去（但 store app 嘅 deployment.json 你控制唔到，預設係 `null`，即用官方 registry）。

**動作**：A2 刪除「`plugin.json` 補 `minGeoLibreVersion`」，改為「A4 手動記錄並在 README/交付文件寫明支援版本；如要 gate 就走 registry PR」。

### 2.2 唔存在 `v2.8.1`（A4 前提要重寫）

- Releases/tags 只有：`v2.7.0 → v2.8.0 → v2.9.0 → v3.0.0`；`v2.8.0` 嘅 `package.json` version 係 `2.8.0`，`v2.9.0` 係 `2.9.0`。
- `gh api .../git/ref/tags/v2.8.1` → 404。
- 所以「我哋 plugin 對 **2.8.1** host contract 寫」呢句最少係版本號寫錯；要查返實際係對邊個 build（2.8.0？自 build？desktop 2.8.x？）。

**動作**：A4 開頭加一步「確認 plugin.js 實際對住邊個 host 版本」，唔好再寫 2.8.1。

### 2.3 Manual URL 安裝唔會彈 trust prompt（A5 描述要改）

- `installUrl()` 只係將 URL 寫入 `pluginManifestUrls` 再 reload，冇額外確認對話框；**你貼 URL 呢個動作本身就係 consent**。
- 「Trust and load」prompt 係另一個路徑：`?plugin=<registry-id>` deep link、或者 **project 內 `plugins.manifestUrls`**（project manifest URL trust），而且 `sideload:false` 時會被抑制。
- 你 A5 寫「貼 manifest URL → install（會彈 trust prompt）→ activate」→ 實際上唔會彈，會直接 load（成功嘅話）。

**動作**：A5 改成「貼 URL → 即時 register/load；如失敗睇 Manage Plugins 嘅 load issue」。

### 2.4 Plugin 內容一改就 held back（A3/A5 部署節奏要改）

- Loader 對每個 **URL plugin** 做 trust-on-first-use pin（hash = entry + style）：
  - 第一次載入：`pinned-first-use`
  - 之後 hash 唔同：`status: "changed"` → **唔載入**，訊息：
    > `Plugin at '<url>' changed since you last trusted it (1.0.0 → 1.1.0) and was not loaded. If Settings → Plugins offers Update, use it; otherwise uninstall it and install it again...`
    （`external-plugins.ts` L385-430、`heldBackPluginMessage` L471-482）
- 即係話：
  - 你每次改 `plugin.js`（即使 version 有 bump），client 舊 pin 都會 refuse，要 **Update（只有 registry 先有）或 uninstall → 重新貼 URL**。
  - 「hotfix plugin.js 即刻見效」係唔成立；**每次交付變更都要叫客戶重裝 plugin**（或做 registry + Update 流程）。
- 另外 loader 對 manifest/entry/style 用 `cache:"no-cache"` 強制 revalidate，所以 cache 唔係問題，pin 才係。

**動作**：A3 加「版本號 bump + 客戶重裝」步驟；A6 指南寫明更新流程；如要平滑更新，考慮 registry entry（`version` + `bundleSha256`）。

### 2.5 Plugin 必須係 self-contained ESM，且 export 要完全對得上（A3 要先驗）

- Manifest：`entry` 必須 `.js` / `.mjs`；`style` 必須 `.css`。
- Loader 係 fetch entry 文字 → `URL.createObjectURL(new Blob(...))` → `import(blobUrl)`，再：
  ```ts
  const candidate = module.default ?? module.plugin;
  ```
  並且檢查：
  - `isGeoLibrePlugin(candidate)`（要有 `id/name/version/activate/deactivate`）
  - `validateManifestMatchesPlugin`：export 出嘅 **id / name / version 必須同 `plugin.json` 完全一致**
  - export 物件唔可以有 `activeByDefault`（會 throw）
  - `engines` 只可以係 `maplibre|mapbox|cesium|arcgis`，預設 `["maplibre"]`
- 「self-contained」係硬性：blob module 內嘅 relative import 解析唔到，`import "./viewer.js"` 會死。所有 code 要 bundle 成一個檔（或用絕對 https import，但會被 CSP `script-src` 擋，見 3.1 附近說明）。
- 如果你哋 `plugin.js` 係 IIFE / 掛 `window.ArboticTwin` / 只有 `activate()` 而冇 export，3.4.0 會直接 `Entry must export a GeoLibrePlugin as default or plugin.`

**動作**：A4 第一步先靜態檢查 `plugin.json` + `plugin.js` 是否符合上面 contract（尤其 id/name/version 三處一致、單一 ESM bundle）。

### 2.6 A3 嘅 `location.origin` fallback 係錯的（會令 mobile 打錯 API）

- Plugin 唔係由你嘅 host 直接執行，而係由 GeoLibre 喺 app 內以 blob module 執行：
  ```ts
  const moduleUrl = URL.createObjectURL(new Blob([bundle.entrySource], {type:"text/javascript"}));
  const module = await import(moduleUrl);
  ```
  （`external-plugins.ts` `importExternalPlugin`）
- 因此 plugin 內：
  - `location.origin` = **GeoLibre app 嘅 origin**：desktop/iOS 係 `tauri://localhost`（docs L1620、L1525），Android 係 `http://tauri.localhost`，web 係 `https://web.geolibre.app`。
  - `import.meta.url` = `blob:...`，唔會透露 plugin 原本 host。
  - 相對 `fetch("./config.json")` 亦會解析去 app origin，唔會去 `/plugin/`。
- 你計劃嘅 priority「plugin config > `location.origin` > `127.0.0.1:8000`」入面，`location.origin` 一落到就會指去 `tauri://localhost`，**唔會指去你嘅 HTTPS engine**。
- 正確做法：engine base 必須**編譯時寫死**（`https://demo.<domain>`）或由用戶/交付設定提供（plugin settings / 首次輸入），唔可以靠 runtime origin 推。

**動作**：A3 改成「engine base = build-time constant（或 plugin 設定），desktop 用 `127.0.0.1:8000` fallback 要明確 gate 喺 `isTauri` 以外／由 config 決定」。

---

## 3. Plan 冇講、但會撞嘅位（4 項，其中 1 個係 blocker）

### 3.1 🔴 `frame-src` CSP 會 block 你個 QSM viewer iframe

`apps/geolibre-desktop/src-tauri/tauri.conf.json` 嘅 CSP：

```
frame-src 'self' http://127.0.0.1:* http://localhost:* https://accounts.google.com https://www.google.com;
child-src 'self' http://127.0.0.1:* http://localhost:* https://accounts.google.com https://www.google.com;
```

- `https://<domain>/viewer/tree_scaled_2` **唔喺 allowlist**（只有 self / localhost / 兩個 Google 網域）。
- Desktop 同 mobile（iOS/Android）用同一份 `tauri.conf.json`，所以手機上一樣 block。
- `connect-src` 有 `https: http:`，所以 `fetch()` 去打 engine **冇問題**；`img-src` 有 `https:`，tiles 冇問題。**只有 iframe 同外部 script 會被擋**。
- Web build 嘅 CSP 可能唔同（唔係 Tauri config），所以 **A4 用 web.geolibre.app 測係測唔到呢個問題**，一定要真機 / simulator。

**可行替代（要改設計）**：
1. Viewer 唔用 iframe，改成 plugin panel 內用 bundled three.js / `<model-viewer>` 自己 render（最可控，但要重寫 viewer 整合）。
2. 開外部瀏覽器：用官方 plugin API `app.openExternalUrl?.(viewerUrl)`（**唔好用 `window.open` / `target="_blank"`**，GeoLibre 自己嘅 `open-external.ts` 明講 Tauri webview 會 ignore，見 §7）。呢個方法唔受 `frame-src` 限制。
3. 只顯示截圖 / 下載連結，唔做 embedded 3D。

**動作**：A4 gate 加一項「iframe CSP 實測」；如確認 block，A5 beats 要改（唔好當 iframe 一定得）。

### 3.2 CORS 收窄會唔會打死 mobile

- Plugin manifest / entry 係由 app 以 `fetch()` 跨 origin 取得，官方文件明講「depends on the host allowing CORS」（`docs/plugin-api.md` L1603）。
- Mobile app origin 係 `tauri://localhost`（iOS/desktop）同 `http://tauri.localhost`（Android），同 web 嘅 `https://web.geolibre.app` 唔同。
- 你 A1 寫「CORS 由 `*` 收窄到 app origin」→ 如果只放一個 origin，另一半（iOS vs Android vs web）會死；而且某些 proxy 會將 `tauri://localhost` 視為 `null` origin。
- **動作**：CORS allowlist 至少要包含：`https://web.geolibre.app`、`tauri://localhost`、`http://tauri.localhost`（如你日后做白牌 build，再加該 app 嘅 origin）；先喺真機確認實際 `Origin` header 再鎖死。

### 3.3 `startup project` 喺 mobile 唔會自動開（A2 要改）

- `?url=https://.../project.geolibre.json` 係 web/URL 參數路徑（`docs/user-guide/projects.md` L31）；mobile app 冇 address bar。
- Desktop 嘅 Startup 設定明確「remote share links are never replayed on launch」。
- Mobile 開 hosted project 只可以：**Project → Open From → URL...** 手動貼。
- 好處：project 檔可以帶 `plugins.manifestUrls` + `activePluginIds`（`docs/project-format.md` L61-84），即「開 project → trust plugin → 自動 activate」，比叫客戶去 Manage Plugins 貼 manifest URL 更順。但前提係 `sideload` 未被關（store app 預設 true；repo 嘅 `deployment.json` 內容係 `null`，冇限制）。
- QR code 唔會一掃即開 app：Android 只處理 `geo:` intent，iOS 官方文件寫 mobile deep-link redirect 係 future work；自訂 scheme 係 desktop 嘅 `org.geolibre.desktop`。

**動作**：A2 唔好叫佢做「startup project 自動開」；改成「Open From → URL」或「一頁指南 + project URL」。QR 只可以 encode URL 文字。

### 3.4 Deployment policy / capabilities 會整個隱藏 plugin 安裝面

- `plugins.sideload` 預設 `true`；`sideload:false` 會令 manual manifest URL 輸入框直接消失（官方 e2e 測試有覆蓋）。
- `capabilities` 嘅 `plugins:install` 控制整個 Plugins menu / marketplace；預設「full grant」。
- 現時官方 repo `public/deployment.json` = `null`，所以你裝 store app 唔會被鎖。但這是 client-side policy，唔係 security boundary（官方文件都咁講）。
- 你 A1 嘅「Basic Auth / Cloudflare Access」係你 engine 嘅保護，同 GeoLibre 無關；GeoLibre 只負責載入 plugin code。


---

## 4. 無法從 GeoLibre repo 核實（屬於你哋自己 repo）

- 你提供嘅 `/workspace` 係 `ykwanstudy-lab/Arbotic-Twin_Prototypes-`，內容係 Vite + React 原型（`src/`、`index.html`），**冇** `apps/map-plugin/`、`services/api/`、`MEMORY.md`、`WEB-DEPLOY-PLAN.md`，亦冇 commit `90b971c`。所以：
  - `plugin.js` 係咪 ESM、有冇 hardcode `127.0.0.1:8000`、`__ARB_MAP__`、layer ids 等，**無法在此核實**。
  - C3 嘅 venv / requirements freeze 狀態亦無法核實。
- 需要喺正確嘅 Arbotic Twin repo / 另一個 branch 再核對。

---

## 5. 建議直接改 plan 嘅位置

| Plan 位置 | 改法 |
|---|---|
| A2 `plugin.json` 補 `minGeoLibreVersion` | 刪；改成 registry entry 才有效，或只作文件記錄 |
| A2 startup project | 改成「Open From → URL」；project 內放 `plugins.manifestUrls` 做 auto-register |
| A3 API base priority | 刪 `location.origin`；改 build-time constant / plugin setting；desktop 127.0.0.1 要明確 gate |
| A3 加 | 「每次 plugin.js 改動 → bump version + 客戶重裝（integrity pin）」 |
| A4 版本 | 確認實際 host 版本；`2.8.1` 不存在（只有 2.8.0 / 2.9.0） |
| A4 gate 加 | ① ESM export contract（id/name/version 一致、單一 bundle）② **iframe CSP 實測**（frame-src 只准 self/localhost）③ mobile 真機（唔好只信 web） |
| A5 trust prompt | 手動 URL 唔會彈；只有 `?plugin=` / project manifest URL 會 |
| A1 CORS | allowlist 要包含 `tauri://localhost`、`http://tauri.localhost`、web origin |
| A0/A5 QR code | 只可以顯示 URL；app 冇 https deep link，唔會掃碼即開；頂多用 `?url=` 喺 web 測 |
| 風險表加 | 「iframe CSP block」、「integrity pin 令更新要重裝」、「CORS 收窄打死 mobile」、「plugin 唔係 ESM 就載入失敗」 |

---

## 6. 參考（官方）

- Repo：https://github.com/opengeos/GeoLibre （MIT，v3.4.0）
- Plugin registry：https://github.com/opengeos/geolibre-plugins
- Plugin API：https://github.com/opengeos/GeoLibre/blob/main/docs/plugin-api.md
- Plugins & Marketplace：https://github.com/opengeos/GeoLibre/blob/main/docs/user-guide/plugins.md
- Deployment policy：https://github.com/opengeos/GeoLibre/blob/main/docs/deployment-policy.md
- iOS / Android：https://github.com/opengeos/GeoLibre/blob/main/docs/ios.md 、`docs/android.md`
- App Store：https://apps.apple.com/app/geolibre/id6796039674 （3.4.0，2026-10-12）
- Google Play：https://play.google.com/store/apps/details?id=org.geolibre.app （3.4.0，2026-10-12）

> 註：以上 GitHub 檔案內容以 2026-10-21 main branch 為準；GeoLibre 出 release 好密（3.0.0 → 3.4.0 只係一個月），A4 前請再 fetch 一次 tag `v3.4.0` 對照。


---

## 7. 2026-10-21 更新檢查（3.4.0 之後）

### 7.1 GeoLibre releases / tags

- **冇新 release、冇新 tag**：latest 仍然係 `v3.4.0`（published `2026-10-11T23:31:31Z`）。
- Store 兩邊都仍然係 **3.4.0**：
  - App Store：`version=3.4.0`、`2026-10-12T15:17:26Z`
  - Google Play：`3.4.0`、`Updated on Oct 12, 2026`
- `main` 已經超前 tag **38 個 commit**，但 `package.json` 仍然寫 `3.4.0`（即未 cut release）。
- 出 release 節奏大約 5–7 日（v3.2 Oct 1 → v3.3 Oct 5 → v3.4 Oct 11），所以 **下一個 release 隨時出**；A4 開工前再 check 一次 tag，唔好當 3.4.0 永遠係最新。

### 7.2 `main` 上 plugin 相關改動（未 release，additive）

38 個 commit 入面同 plugin 有關嘅：

- `feat(plugins): add updateGeoJsonLayer and removeLayer to the plugin API (#3128)`
- `feat(plugins): honor expected-status markers in nativeFetch diagnostics (#3124)`
- `feat(plugins): OAuth authorization-code sign-in for plugins (#3139)`
- `feat(plugins): add addVectorTileLayer to the plugin API (#3140)`
- `feat(plugins): GeoEditor session events and startEditSession for plugins (#3138)`
- `feat(assistant): let the assistant turn on an installed plugin and use its tools in the same turn (#3160)`
- `feat(plugins): pass the cancel signal to assistant tool specs (#3161)`

全部係**新增 API**，冇 breaking；但呢啲**未喺 3.4.0 store build**，A4 唔可以依賴。

**CSP 冇變**：`tauri.conf.json` 由 v3.4.0 到 main 只改咗 pglite CDN 版本（0.5.8 → 0.5.10），`frame-src` 完全一樣：

```
frame-src 'self' http://127.0.0.1:* http://localhost:* https://accounts.google.com https://www.google.com;
```

→ **iframe blocker 喺下一個 release 都仍然存在**，唔會自動消失。

### 7.3 `geolibre-plugins` registry 格式

- **兩個 schema 自 2026-10-09 之後冇再改**（`plugin-manifest.schema.json` 最後改動 2026-10-04；`registry-entry.schema.json` 最後改動 2026-10-09，加 `Cartography` category）。
- 3.4.0 之後嘅 commit 全部係**內容更新**，唔係格式：
  - `Add KML/KMZ import plugin (#33)`
  - `feat: add Poster Studio map poster plugin (#107)`
  - `Add Mapterhorn Terrain plugin (#108)`
  - `Update openrndt-geolibre to 0.3.13 / 0.3.14 (#110 / #111)`
- 所以：`minGeoLibreVersion` **仍然只係 registry entry 欄位**；manual manifest URL 仍然**冇版本閘**；`plugin.json` 加呢個 key 仍然零作用。
- 補充：`registry-entry.schema.json` 係 `additionalProperties: false`，如果將來出 PR 打錯 `minGeolibreVersion`（細楷 l），CI 會直接 fail。

---

## 8. ⚠️ v2 要再改一處：`window.open` / `target="_blank"` 喺 Tauri 係唔 work 的

呢點直接推翻 v2 嘅「CSP mitigation 只係突出條 `<a target=\"_blank\">`；KP ALS 用 `window.open` 免改」。

證據（GeoLibre 自己嘅 code）：

`apps/geolibre-desktop/src/lib/open-external.ts` 開頭註解：

> The Tauri webview ignores `target="_blank"`/`window.open`, so route through the opener plugin there and fall back to `window.open` on the web build.

而同一個檔嘅 `isTauri()`（`apps/geolibre-desktop/src/lib/is-tauri.ts`）係：

```ts
return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
```

→ iOS / Android app 都符合（唔止 desktop），所以 `window.open` / `target="_blank"` 喺手機 store app **一樣會被 ignore**。

正確做法：官方 plugin API 有 `openExternalUrl`：

```ts
// packages/plugins/src/types.ts
openExternalUrl?: (url: string) => void;
```

- `v3.4.0`：`packages/plugins/src/types.ts` **L950 已經有**
- `v2.8.0`：同一欄位 **L550 已經有**（即你哋 desktop 版都用得）
- `app-api.ts` v3.4.0 L574：
  ```ts
  openExternalUrl: (url: string) => void openExternalLink(url),
  ```
- main 嘅 docs 已經補咗一句：
  > desktop webview ignores `window.open`/`target="_blank"` … Plugins should call this rather than `window.open` directly.
- **但 3.4.0 嘅 `docs/plugin-api.md` 完全冇提 `openExternalUrl`**（grep 0 次），所以只睇 3.4.0 docs 係唔會發現。

建議寫法（optional chaining，兼容其他 host）：

```js
const openExternal = (url) => {
  if (app?.openExternalUrl) app.openExternalUrl(url);
  else window.open(url, "_blank", "noopener,noreferrer");
};
```

- `<a>` 都要加 click handler：`e.preventDefault(); openExternal(url)`（保留 `href` 俾 web fallback / 右鍵複製）。
- `capabilities/default.json` 已經有 `opener:allow-open-url`（`http://*` / `https://*`），所以 opener 喺 mobile 有 permission。
- **仍然要真機試**：`openExternalUrl` 係 optional API，舊 host（2.8.0 desktop）有，但白牌 / 其他 host variant 可能冇，所以 fallback 一定要保留。

---

## 9. 對 v2 嘅淨影響（3 條）

1. **A3 CSP 對策要改**：唔係「突出 `<a target=_blank>`」，而係「所有外開一律經 `app.openExternalUrl`」；**KP ALS 嘅 `window.open` 要改，唔係免改**。
2. **A4 gate 加一項**：真機測 `openExternalUrl`（iframe 被 block 後嘅外開路徑），同時測 fallback `<a>` / `window.open` 係唔係真係死；`openExternalUrl` 喺 3.4.0 runtime 有、docs 冇，**靠 types 唔靠 docs**。
3. **Registry 格式無變**：`minGeoLibreVersion` 仍然只喺 registry entry；`plugin.json` 加咗都冇用。下次 release 前再 check tag（main 已超前 38 commits）。

> 更新檢查時間：2026-10-21；下次 A4 開工前建議再跑一次 `gh api repos/opengeos/GeoLibre/releases/latest`。

