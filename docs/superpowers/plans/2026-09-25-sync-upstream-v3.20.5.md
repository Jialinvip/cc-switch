# Sync upstream v3.20.4 → fork v3.20.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **本文件是工作计划，不要提交进 git**（保持 untracked）。定制记录写进 `docs/FORK-定制说明.md`。

**Goal:** 按 `docs/FORK-定制说明.md` 的维护策略把 fork（Jialinvip/cc-switch，当前 v3.17.2）同步到上游 v3.20.4（farion1231/cc-switch，+360 提交），重套「官方端点 + One API」定制（含上游新增的 3 个预设清单），版本定为 v3.20.5，本地验证通过后提交（不推送、不打标签）。

**Architecture:** 先把 fork merge 成干净的上游（预设文件整体取上游），完成 merge commit；再以一个定制 commit 重新套用三处定制（预设裁剪 + One API 回填、Rust 种子核验、测试清理）。裁剪规则：预设数组只保留 `name === "One API" || isOfficial === true || category === "official"`（注意 `cn_official` 不算官方，属第三方厂商，删）。

**Tech Stack:** git merge / pnpm / vitest / tsc（Rust cargo 本机不可用，见 Task 6）

## Global Constraints

- 裁剪规则（唯一判据）：`name === "One API" || isOfficial === true || category === "official"`；`cn_official`、`third_party`、`aggregator`（除 One API）一律删。
- One API 条目以 **merge 前 fork 版本**为准：`git show 204a3d53:src/config/<file>.ts` 中 `name: "One API"` 对象，逐字段拷回；**不要**重新发明条目内容。
- 文件头部的 interface、导出常量、导出函数原样保留（上游可能新增字段，如 `promptCacheRouting?: PromptCacheRoutingMode`、`primePartner?: boolean`，重写时务必保留）。
- 删除预设后必须清理因此空置的本地 helper，否则 `noUnusedLocals` 使 `tsc` 失败。
- 版本号统一 **3.20.5**（package.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json / src-tauri/Cargo.lock）。
- 本次只本地 commit：**不 push、不打 tag、不动本机数据库**。
- 已知上游改名：`OPENCODE_PRESET_MODEL_VARIANTS` 里 `google/gemini-3.5-flash` → `google/gemini-3.6-flash`（名称 "Gemini 3.5 Flash" → "Gemini 3.6 Flash"），引用处要跟着改。

## 现状快照（已核实）

- merge-base：`997be22b`；fork HEAD：`204a3d53`（v3.17.2，含 One API 定制）；upstream/main：`a06a41ec`（v3.20.4 + 8 提交）。
- 上游新出现的预设文件（fork 没有）：`grokBuildProviderPresets.ts`、`piProviderPresets.ts`、`mcodeProviderPresets.ts`（**从 pi 派生**）、`piModelCatalog.ts`、`piThinkingProfiles.ts`。
- 上游把部分测试挪到 `src/config/` 同目录：`codexProviderPresets.test.ts`、`codexProviderPresets.tokenPlanTextOnly.test.ts`、`codingPlanProviders.test.ts`、`grokBuildProviderPresets.test.ts`、`jiekouProviderPresets.test.ts`、`ppioProviderPresets.test.ts`。
- `src/config/iconInference.ts`：上游已删（dead code）；fork 未改过 → merge 会自动删除。
- `AppType` 新增 `Pi`、`Mcode`（as_str: `"pi"` / `"mcode"`）。
- mcode 派生过滤器：`MCODE_API_FORMATS.some(api === config.api) && !config.compat && config.models.every(m => !m.compat)`——One API 的 Pi 条目必须无 compat 才能派生进 mcode。
- Pi 的 `materializeVerifiedThinkingProfiles`：带 `thinkingProfile` 显式指定时走 `getPiThinkingProfile`（**不注入 compat**）；不指定时走 `resolvePiThinkingProfile` 绑定，`anthropic/claude-opus-4.8` + `anthropic-messages` 绑定会注入 `modelCompat: { forceAdaptiveThinking: true }`。

---

### Task 1: merge 上游并解决冲突

**Files:**
- Modify（冲突解决）: `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.lock`、`src/icons/extracted/index.ts`、`pnpm-workspace.yaml`
- Delete（modify/delete 冲突 → git rm）: `.github/workflows/release.yml`、`tests/config/claudeProviderPresets.test.ts`、`tests/config/codexChatProviderPresets.test.ts`、`tests/config/therouterProviderPresets.test.ts`、`tests/config/doubaoSeedPresets.test.ts`、`tests/config/longcatProviderPresets.test.ts`、`tests/config/subrouterProviderPresets.test.ts`、`tests/config/mimoTokenPlanPresets.test.ts`
- Take upstream（整体覆盖）: `src/config/*ProviderPresets.ts`（8 个旧文件）

**Interfaces:**
- Produces: 一个完成的 merge commit（预设文件 = 纯上游内容，One API 条目此时缺失，Task 2/3 回填）。

- [ ] **Step 1: 开始 merge，收集冲突清单**

```bash
cd /e/Documents/GitHub/cc-switch
git fetch upstream
git merge --no-commit --no-ff upstream/main
git status --short | grep -E '^(UU|AA|DU|UD|AU|UA)' 
```

Expected: 一长串冲突列表（预计 13+ 个）。记录下来，按下面步骤分类解决。

- [ ] **Step 2: 8 个预设文件整体取上游**

```bash
git checkout upstream/main -- src/config/claudeProviderPresets.ts \
  src/config/claudeDesktopProviderPresets.ts \
  src/config/codexProviderPresets.ts \
  src/config/geminiProviderPresets.ts \
  src/config/hermesProviderPresets.ts \
  src/config/openclawProviderPresets.ts \
  src/config/opencodeProviderPresets.ts \
  src/config/universalProviderPresets.ts
```

Expected: 这 8 个文件无冲突、内容为纯上游（含第三方预设、无 One API）。

- [ ] **Step 3: 版本号 4 处统一设为 3.20.5**

冲突解决规则（fork 版本行 vs 上游版本行，两边各一行 → 统一改成 fork 新版本号）：

- `package.json` → `"version": "3.20.5"`
- `src-tauri/Cargo.toml` → `version = "3.20.5"`（`[package]` 节）
- `src-tauri/tauri.conf.json` → `"version": "3.20.5"`
- `src-tauri/Cargo.lock` → 所有 `name = "cc-switch"` 条目下的 `version = "3.20.5"`

- [ ] **Step 4: 图标 index：取上游 + 保留 oneapi**

`src/icons/extracted/index.ts`：以**上游版本**为基础，加回 fork 的两行（位置放在导入区和 map 区的合适位置，字母序或贴邻近条目即可）：

```ts
import _oneapi from "./oneapi.png";
// ... 在图标 map 里：
  oneapi: _oneapi,
```

上游新增图标（如 `sub2api`）**全保留**；上游已删的图标（如 `lemondata`）跟着删。oneapi.png 文件本身不受影响（上游没动它）。

- [ ] **Step 5: pnpm-workspace.yaml：保留 fork 的 allowBuilds 块 + 上游的列表**

最终内容 = fork 当前的完整文件（它已包含 `allowBuilds` + `onlyBuiltDependencies` + `ignoredBuiltDependencies` 三块）：

```yaml
packages: []

allowBuilds:
  esbuild: true
  msw: false

onlyBuiltDependencies:
  - '@tailwindcss/oxide'
  - esbuild

ignoredBuiltDependencies:
  - msw
```

（上游删了 `allowBuilds`，但 fork 的 `allowBuilds` 是 pnpm 构建放行的修复，保留。）

- [ ] **Step 6: modify/delete 冲突：保持删除**

```bash
git rm .github/workflows/release.yml \
  tests/config/claudeProviderPresets.test.ts \
  tests/config/codexChatProviderPresets.test.ts \
  tests/config/therouterProviderPresets.test.ts \
  tests/config/doubaoSeedPresets.test.ts \
  tests/config/longcatProviderPresets.test.ts \
  tests/config/subrouterProviderPresets.test.ts \
  tests/config/mimoTokenPlanPresets.test.ts
```

（若某个文件不在冲突列表里，跳过即可；`release.yml` 是上游的签名发布流程，fork 用 `build-windows.yml`。）

- [ ] **Step 7: 其余内容冲突按规则解决**

- `tests/config/therouterOpenCodeOpenClawPresets.test.ts`（modify/modify）→ **取 fork 版**（`git checkout --ours` 后 `git add`），但把其中 `gemini-3.5-flash` / `"Gemini 3.5 Flash"` 改成 `gemini-3.6-flash` / `"Gemini 3.6 Flash"`（跟上游改名）。
- `tests/config/opencodeProviderPresets.test.ts`、`tests/config/codexTemplates.test.ts`（若冲突）→ 取 fork 版，同样检查 gemini 改名。
- `src-tauri/src/database/dao/providers.rs`、`src-tauri/src/lib.rs` → 期望 auto-merge 干净；若冲突，两侧都保留：上游的新代码 + fork 的 `init_default_oneapi_providers` / `oneapi_providers_seeded`（见 Task 5 的核验点）。
- 其他任何没列出的冲突文件 → **跟上游**（`git checkout --theirs`），除非它明显是 fork 专有文件（如 `docs/FORK-定制说明.md`、`.github/workflows/build-windows.yml`，这两个保持 fork 版）。

- [ ] **Step 8: 收尾合并**

```bash
git status --short | grep -E '^(UU|AA|DU|UD|AU|UA)' ; echo "conflicts-left=$?"
git add -A
git commit -m "Merge upstream v3.20.4 (presets taken from upstream; re-apply fork customizations next)"
```

Expected: `conflicts-left` 无输出（grep 找不到剩余冲突）；merge commit 成功。

---

### Task 2: 重套定制 #1 —— 8 个旧预设文件裁剪 + One API 回填

**Files:**
- Modify: `src/config/claudeProviderPresets.ts`、`src/config/claudeDesktopProviderPresets.ts`、`src/config/codexProviderPresets.ts`、`src/config/geminiProviderPresets.ts`、`src/config/hermesProviderPresets.ts`、`src/config/openclawProviderPresets.ts`、`src/config/opencodeProviderPresets.ts`、`src/config/universalProviderPresets.ts`

**Interfaces:**
- Consumes: Task 1 的纯上游预设文件。
- Produces: 每个数组只剩官方项 + One API；`passthroughRoutes`、`generateThirdPartyAuth`、`generateThirdPartyConfig`、`OPENCODE_PRESET_MODEL_VARIANTS`、`getPresetModelDefaults`、`createUniversalProviderFromPreset` 等 helper 保留且被引用。

- [ ] **Step 1: 回填 One API 条目（先取模板，防 checkout 冲掉）**

每个文件的 One API 对象从 merge 前 fork 版本取：

```bash
git show 204a3d53:src/config/claudeProviderPresets.ts | sed -n '/name: "One API"/,/^  },/p'
```

对 8 个文件各执行一次（换文件名），把输出的对象体逐文件粘回**数组末尾**。已知各文件 One API 要点（以 `git show 204a3d53:...` 实际内容为准，此处只是核对清单）：

| 文件 | One API 条目关键字段 | 依赖 helper |
|------|------|------|
| claude | `settingsConfig.env.ANTHROPIC_BASE_URL="https://www.oneapi.work"`、空 `ANTHROPIC_AUTH_TOKEN`、`category:"aggregator"`、`icon:"oneapi"` | 无 |
| claudeDesktop | `baseUrl:"https://www.oneapi.work"`、`mode:"direct"`、`apiFormat:"anthropic"`、`modelRoutes: passthroughRoutes()` | **passthroughRoutes（保留）** |
| codex | `auth: generateThirdPartyAuth("")`、`config: generateThirdPartyConfig("oneapi","https://www.oneapi.work/v1","gpt-5.5")` | **generateThirdPartyAuth/Config（保留）** |
| gemini | `env.GOOGLE_GEMINI_BASE_URL` + 空 `GEMINI_API_KEY` + `GEMINI_MODEL:"gemini-3.5-flash"` | 无 |
| hermes | `settingsConfig.name:"oneapi"`、`base_url:"https://www.oneapi.work/v1"`、`api_mode:"chat_completions"`、`models:[{id:"gpt-5.5",name:"GPT-5.5"}]`、`suggestedDefaults` | 无 |
| openclaw | `settingsConfig.baseUrl:"https://www.oneapi.work"`、`api:"anthropic-messages"`、`models:[opus-4-8, sonnet-4-6]`、`templateValues`、`suggestedDefaults` | 无 |
| opencode | `npm:"@ai-sdk/anthropic"`、`options.baseURL:"https://www.oneapi.work/v1"`、`setCacheKey:true`、`models:{claude-sonnet-4-6, claude-opus-4-8}` | 无 |
| universal | `providerType:"oneapi"`、`defaultModels: NEWAPI_DEFAULT_MODELS`、`websiteUrl:"https://www.oneapi.work"`、`icon:"oneapi"` | NEWAPI_DEFAULT_MODELS 常量（上游仍在则保留引用） |

- [ ] **Step 2: 按保留清单裁剪各数组**

| 文件 | 保留（其余全删） |
|------|------|
| claudeProviderPresets | Claude Official · One API |
| claudeDesktopProviderPresets | Claude Desktop Official · One API |
| codexProviderPresets | **仅** OpenAI Official · One API（Azure OpenAI 也删） |
| geminiProviderPresets | Google Official · One API（「自定义」删） |
| hermesProviderPresets | Nous Research（官方）· One API |
| openclawProviderPresets | One API（无官方预设） |
| opencodeProviderPresets | One API（无官方预设） |
| universalProviderPresets | One API（NewAPI、「自定义网关」都删） |

- [ ] **Step 3: 清理空置 helper（noUnusedLocals）**

- claudeDesktop：删 `mappedRoutes` / `brandedRoutes`（One API 只用 `passthroughRoutes`）。
- codex：删本地 `modelCatalog` 及其专用类型/常量（若只剩它引用）。
- 其他文件：删掉只剩被删预设引用的本地函数/常量/类型；**接口声明、导出常量、导出函数不动**。

- [ ] **Step 4: 类型检查确认**

```bash
pnpm typecheck
```

Expected: 零错误（若 esbuild 构建失败，先 `pnpm approve-builds esbuild && pnpm install`）。

- [ ] **Step 5: 暂不提交**（与 Task 3/4 合成一个定制 commit）

---

### Task 3: 新应用 3 个预设清单裁剪 + 补 One API + 守卫测试扩展

**Files:**
- Modify: `src/config/grokBuildProviderPresets.ts`、`src/config/piProviderPresets.ts`、`src/config/mcodeProviderPresets.ts`
- Modify: `tests/config/onlyOfficialAndOneApiPresets.test.ts`
- Keep as-is（模型元数据助手，**不动**）: `src/config/piModelCatalog.ts`、`src/config/piThinkingProfiles.ts`

**Interfaces:**
- Consumes: Task 2 的裁剪规则；`piModel()`、`grokPresetConfig()`、`grokAuth()`、`GROK_BUILD_DEFAULT_MODEL`。
- Produces: grokBuild = Grok Official + One API；pi = One API（无官方）；mcode 由 pi 自动派生出 One API；守卫测试覆盖 11 个清单。

- [ ] **Step 1: 先扩展守卫测试（红）**

`tests/config/onlyOfficialAndOneApiPresets.test.ts`：导入区加：

```ts
import {
  grokBuildOfficialPreset,
  grokBuildProviderPresets,
} from "@/config/grokBuildProviderPresets";
import { piProviderPresets } from "@/config/piProviderPresets";
import { mcodeProviderPresets } from "@/config/mcodeProviderPresets";
```

`presetLists` 数组追加 3 行（放在末尾）：

```ts
  ["grokbuild", [grokBuildOfficialPreset, ...grokBuildProviderPresets]],
  ["pi", piProviderPresets],
  ["mcode", mcodeProviderPresets],
```

Run: `pnpm test tests/config/onlyOfficialAndOneApiPresets.test.ts`
Expected: **FAIL**（新清单里有第三方预设 / 缺 One API）。

- [ ] **Step 2: grokBuildProviderPresets.ts**

保留 `grokBuildOfficialPreset`（原样，含 `GROKBUILD_OFFICIAL_PROVIDER_ID` 相关注释）和文件头接口；`grokBuildProviderPresets` 数组只留 One API（**新增**此条目）：

```ts
export const grokBuildProviderPresets: GrokBuildProviderPreset[] = [
  {
    name: "One API",
    websiteUrl: "https://www.oneapi.work",
    apiKeyUrl: "https://www.oneapi.work",
    auth: grokAuth(),
    config: grokPresetConfig("One API", "https://www.oneapi.work/v1"),
    endpointCandidates: ["https://www.oneapi.work/v1"],
    category: "aggregator",
    icon: "oneapi",
  },
];
```

清理：删 `OPENROUTER_STYLE_GROK_MODEL`（空置）；保留 `grokAuth`、`grokPresetConfig`、`GROK_BUILD_DEFAULT_MODEL` 导入（One API 条目引用）。

- [ ] **Step 3: piProviderPresets.ts**

`piProviderPresetDefinitions` 数组只留 One API（**新增**此条目，放数组首位）：

```ts
  {
    name: "One API",
    providerKey: "cc-switch-oneapi",
    websiteUrl: "https://www.oneapi.work",
    apiKeyUrl: "https://www.oneapi.work",
    settingsConfig: {
      name: "One API",
      baseUrl: "https://www.oneapi.work",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-sonnet-4.6", { id: "claude-sonnet-4-6" }),
        // 显式 thinkingProfile 走 getPiThinkingProfile、不注入绑定的
        // forceAdaptiveThinking compat——否则 mcode 派生过滤器会把
        // 整个 One API 条目滤掉（其要求所有 model 无 compat）。
        piModel("anthropic/claude-opus-4.8", {
          id: "claude-opus-4-8",
          thinkingProfile: "xhighAndMax",
        }),
      ],
    },
    category: "aggregator",
    icon: "oneapi",
  },
```

清理：删 `OPENAI_COMPLETIONS_COMPAT`、`DEEPSEEK_THINKING_COMPAT`、`TENCENT_DEEPSEEK_THINKING_COMPAT`、`XIAOMI_THINKING_COMPAT`、`QWEN_THINKING_COMPAT`、`KIMI_K3_COMPAT` 等只剩被删预设引用的本地常量。**保留**：`piModel`/`PiCatalogModel` 导入、`PiApiFormat`/`PiPresetModel`/`PiProviderPreset` 接口、`materializeVerifiedThinkingProfiles` 函数、末尾 `export const piProviderPresets = piProviderPresetDefinitions.map(...)`。

- [ ] **Step 4: mcodeProviderPresets.ts —— 验证派生即可**

不改逻辑（它是 `piProviderPresets.filter(...).map(...)` 派生）。pi 的 One API 条目 `api: "anthropic-messages"` ∈ `MCODE_API_FORMATS`、无 compat → 自动派生出 One API。若派生为空（测试挂），检查 Step 3 的 thinkingProfile 是否漏写，**不要**去改过滤器。

- [ ] **Step 5: 守卫测试转绿**

Run: `pnpm test tests/config/onlyOfficialAndOneApiPresets.test.ts`
Expected: PASS（原 8 项 + 新 3 项 = 11 组 × 2 断言全部通过）。

- [ ] **Step 6: 类型检查**

Run: `pnpm typecheck`
Expected: 零错误。

---

### Task 4: 测试清理与改写

**Files:**
- Delete: `src/config/jiekouProviderPresets.test.ts`、`src/config/ppioProviderPresets.test.ts`、`src/config/codexProviderPresets.tokenPlanTextOnly.test.ts`、`tests/config/qianfanTokenPlanPresets.test.ts`、`tests/config/tokenPlanProviderPresets.test.ts`、`tests/config/xaiOauthProviderPresets.test.ts`、`tests/config/piProviderPresets.test.ts`
- Modify: `tests/components/GrokBuildProviderForm.test.tsx`、`tests/config/therouterOpenCodeOpenClawPresets.test.ts`（gemini 改名）、`src/config/codexProviderPresets.test.ts`（视情况）
- Keep: `src/config/grokBuildProviderPresets.test.ts`（One API 条目按 Task 3 写法可通过）、`src/config/codingPlanProviders.test.ts`（测路由表非预设）、`tests/config/piThinkingProfiles.test.ts`（测保留的 helper）、`tests/config/codexTemplates.test.ts`、`tests/config/opencodeProviderPresets.test.ts`（fork 版）

**Interfaces:**
- Consumes: Task 2/3 裁剪后的预设清单。
- Produces: `pnpm test` 全绿。

- [ ] **Step 1: 删掉测「已删厂商」的测试**

```bash
cd /e/Documents/GitHub/cc-switch
git rm -f src/config/jiekouProviderPresets.test.ts \
  src/config/ppioProviderPresets.test.ts \
  src/config/codexProviderPresets.tokenPlanTextOnly.test.ts \
  tests/config/qianfanTokenPlanPresets.test.ts \
  tests/config/tokenPlanProviderPresets.test.ts \
  tests/config/xaiOauthProviderPresets.test.ts \
  tests/config/piProviderPresets.test.ts
```

（`piProviderPresets.test.ts` 断言 ≥50 个预设，裁剪后必挂 → 删；约束由守卫测试兜底。）

- [ ] **Step 2: 改写 GrokBuildProviderForm.test.tsx（以 merge 后的上游版为基础）**

上游已重写此测试（curated Grok Build presets）。改法：把「点击 PatewayAI」用例换成 One API：

```ts
    // 国产官方直连（cn_official）不在 Grok Build 预设列表里
    expect(screen.queryByRole("button", { name: /BytePlus/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Kimi/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /One API/ }));

    const baseUrlInput =
      container.querySelector<HTMLInputElement>("#codexBaseUrl");
    const nameInput =
      container.querySelector<HTMLInputElement>('input[name="name"]');
    expect(baseUrlInput?.value).toBe("https://www.oneapi.work/v1");
    expect(nameInput?.value).toBe("One API");
```

其余用例（"uses the Codex-style advanced section…"、"keeps the Grok client on Responses…"，后者用裸 TOML）保留不动；用例标题里 "offers curated Grok Build presets and applies one" 不用改。

- [ ] **Step 3: gemini 改名扫尾**

```bash
grep -rn "gemini-3.5-flash\|Gemini 3.5 Flash" tests/ src/config/
```

凡在 `OPENCODE_PRESET_MODEL_VARIANTS` 相关断言里的（`therouterOpenCodeOpenClawPresets.test.ts` 等）→ 改成 `gemini-3.6-flash` / `"Gemini 3.6 Flash"`。**预设条目本身**（如 geminiProviderPresets 的 One API `GEMINI_MODEL`）不动。

- [ ] **Step 4: 检查 codexProviderPresets.test.ts（同目录新测试）**

Run: `pnpm test src/config/codexProviderPresets.test.ts`

- 若 "OAuth presets never declare the auth.json fallback" 因裁剪后 `requiresOAuth` 预设数为 0 或官方条目 config 不含 `requires_openai_auth = false` 而挂 → 只保留第二个用例（`generateThirdPartyConfig` 模板断言），删掉第一个用例。
- "key-based third-party template keeps the fallback flag" 用例必须保留并通过（helper 未删）。

- [ ] **Step 5: 全量测试 + 逐个扫尾**

```bash
pnpm test
```

对每个失败文件按规则处理（这是既有惯例，v3.16.7/v3.17.1 都这么做）：
- 测的是**已删第三方预设** → `git rm -f <file>`。
- 测的是**保留功能**但断言引用了被删条目/改名 → 改断言。
- `tests/integration/App.test.tsx` 偶发超时（上游也偶发）→ 重跑确认；连续失败才查。
- 不确定归类时：看断言里的 `name` 是否满足裁剪规则，不满足即「已删厂商」。

Expected: `pnpm test` 全部通过（含守卫测试 11 组）。

---

### Task 5: 定制 #2 核验 —— Rust One API 种子

**Files:**
- Verify only: `src-tauri/src/database/dao/providers.rs`、`src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: Task 1 的 merge 结果。
- Produces: 确认记录（写入 Task 6 的同步实录）。

- [ ] **Step 1: 核验种子仍在位**

```bash
grep -n "init_default_oneapi_providers\|oneapi_providers_seeded" \
  src-tauri/src/database/dao/providers.rs src-tauri/src/lib.rs
```

Expected: providers.rs 里有方法定义 + flag 读写（约 667/672/815 行附近）；lib.rs 里在 `init_default_official_providers()` **之后**调用（约 610 行附近）。若缺失 → 从 `git show 204a3d53:...` 找回对应函数体和调用点补回。

- [ ] **Step 2: 核对7 个种子的 settings_config 与前端 One API 条目一致**

`init_default_oneapi_providers` 的 `seeds` 数组应含 7 项：`claude-oneapi` / `claude-desktop-oneapi` / `codex-oneapi` / `gemini-oneapi` / `opencode-oneapi` / `openclaw-oneapi` / `hermes-oneapi`。与 Task 2 表格中各 One API 条目字段对照（BASE_URL / model 名），有出入以**前端 merge 后条目**为准微调 Rust 常量（如 `gpt-5.5`、`claude-opus-4-8` 等模型名）。

- [ ] **Step 3: 本机无 cargo 的处理**

```bash
command -v cargo || echo "NO_CARGO"
```

Expected: `NO_CARGO`（与 v3.17.1 相同，本机没 Rust 工具链）。人工确认种子代码语义完整后**跳过** `cargo check/test`，在同步实录里注明「Rust 未跑，发版前在有 Rust 的机器补跑或依赖 CI」。若意外有 cargo → `cd src-tauri && cargo check && cargo test` 全绿才算过。

---

### Task 6: 更新定制文档 + 全量验证 + 定制 commit

**Files:**
- Modify: `docs/FORK-定制说明.md`
- Commit: Task 2–5 的全部工作树改动

- [ ] **Step 1: FORK-定制说明.md 增补**

1. **定制清单 #1** 表格追加 3 行（并注明 mcode 派生特性）：

```markdown
| grokBuildProviderPresets | Grok Official · One API |
| piProviderPresets | One API（无官方预设） |
| mcodeProviderPresets | One API（**从 pi 派生**，勿手改数组；保证 pi 的 One API 无 compat 即可） |
```

并在注意事项补两条：
- `piProviderPresets` 的 One API 条目给 `claude-opus-4.8` 显式 `thinkingProfile: "xhighAndMax"`，防止绑定注入 compat 导致 mcode 派生把 One API 滤掉。
- `grokBuildProviderPresets.ts` 有独立的 `grokBuildOfficialPreset` 导出（在数组外），裁剪数组即可，官方条目别动。

2. **同步实录**顶部加一节 `### v3.20.5（2026-09-25，对应上游 v3.20.4）`，记录：上游提交数 360；冲突文件清单（按 Task 1 实际情况）；新增 3 预设文件的处理；上游 gemini-3.5→3.6 改名；删除的测试文件清单（Task 4）；验证结果（下面 Step 2 的真实输出）；Rust 未跑的说明。

- [ ] **Step 2: 全量验证（必须本地跑，结果如实写进实录）**

```bash
pnpm install
pnpm typecheck
pnpm test
cd src-tauri && (command -v cargo >/dev/null && cargo check && cargo test || echo "SKIP_CARGO: no toolchain")
```

Expected: install 无占位串报错；typecheck 零错误；vitest 全绿（含守卫 11 组）；cargo SKIP 或全绿。

- [ ] **Step 3: 定制 commit**

```bash
git add -A
git status --short   # 确认 docs/superpowers/plans/ 不在暂存区
git commit -m "feat: sync upstream v3.20.4, re-apply One API + official-only presets

- Trim all 11 preset lists back to 官方 + One API (per docs/FORK-定制说明)
- Add One API entries for new apps: Grok Build / Pi (Mcode derives from Pi)
- Bump fork version to 3.20.5 across package.json / Cargo.toml / tauri.conf.json / Cargo.lock
- Keep oneapi icon alongside upstream's new icons (sub2api etc.)
- Drop upstream tests for removed third-party presets (jiekou / ppio / qianfan / tokenPlan / xaiOauth / pi roster)
- Adapt GrokBuildProviderForm tests to the trimmed preset list; follow gemini-3.5→3.6 rename
- Extend onlyOfficialAndOneApiPresets guard to 11 lists"
```

Expected: commit 成功；`git log --oneline -3` 显示 merge commit + 定制 commit（+版本无关的旧提交）。**不 push、不打 tag。**

---

## Self-Review 记录

- **Spec 覆盖**：定制 #1（11 清单裁剪 + One API 回填）→ Task 2/3；定制 #2（Rust 种子）→ Task 5；定制 #3（本机 DB）→ 用户已选跳过，不设任务；测试约定 → Task 4 + 守卫扩展；验证命令 → Task 6；发布 → 用户已选「本地提交」，不设 push/tag 任务。✓
- **占位符扫描**：所有 One API 条目给了完整字段清单或 `git show 204a3d53:...` 精确取源命令；无 TBD。✓
- **类型一致性**：`grokAuth()`/`grokPresetConfig()` 与上游签名一致（`grokPresetConfig(providerName, baseUrl, model?)`）；`piModel(catalogKey, options)` 中 `thinkingProfile` 的类型 `PiThinkingProfileId` 含 `"xhighAndMax"`（绑定文件里 `profileId: "xhighAndMax"` 证实）。✓
