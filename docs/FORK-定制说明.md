# Fork 定制说明：只保留「官方端点 + One API」

> 本文档仅适用于本 fork（`Jialinvip/cc-switch`），用于记录相对上游
> `farion1231/cc-switch` 的定制改动，方便每次同步上游后**重新套用**。
>
> 参考提交：`d1b381cf "OneAPI"`（初版定制）、`fc6070ba`（v3.16.7 同步）。

## 一句话目标

每个应用的供应商清单**只保留两个端点**：该应用的「官方端点」和「One API」，
并让 **One API 默认启用**。上游频繁新增的第三方厂商端点一律不要。

## 维护策略：当补丁重打，别跟上游 merge 硬解冲突

上游几乎每次更新都在改这些预设文件。**不要**去逐行解决 merge 冲突，
而是：**先把 fork 同步成干净的上游（=完整上游），再把下面三件事重新套用一遍。**

```bash
git fetch upstream
git merge --no-commit --no-ff upstream/main   # 先看冲突列表
# 对 8 个预设文件，直接取上游版本（这些文件会整体重写）：
git checkout upstream/main -- src/config/claudeProviderPresets.ts \
  src/config/claudeDesktopProviderPresets.ts \
  src/config/codexProviderPresets.ts \
  src/config/geminiProviderPresets.ts \
  src/config/hermesProviderPresets.ts \
  src/config/openclawProviderPresets.ts \
  src/config/opencodeProviderPresets.ts \
  src/config/universalProviderPresets.ts
# 对其他冲突文件（版本号、图标 index、Cargo.lock 等）逐一手工解决
# 解决完所有冲突后 git add + git commit（完成 merge）
# 然后重新套用本文档的三处定制（作为一个新 commit）
```

> **经验谈**（v3.16.7 同步）：
> - 版本号文件（`package.json` / `Cargo.toml` / `tauri.conf.json` / `Cargo.lock`）
>   冲突最简单：fork 版本和上游版本各一行，统一设成 fork 的新版本号即可。
> - `src/icons/extracted/index.ts` 会有 fork 新增的 `oneapi` 图标 import/export
>   冲突，保留 oneapi，删掉上游已移除的图标（如 `lemondata`）即可。
> - `tests/config/codexChatProviderPresets.test.ts` 会是 modify/delete 冲突：
>   fork 删了、上游改了——直接 `git rm` 删掉，它测试的是已删除的厂商。
> - `src-tauri/src/database/dao/providers.rs` 和 `src-tauri/src/lib.rs` 的
>   One API 种子代码通常能 auto-merge 干净（这两个文件上游不常改）。

上游那些**有用的改动**（bug 修复、代理改进、新模型定价、新功能）跟着上游走、保留；
**没用的**（一堆新厂商端点预设）按下面规则筛掉即可。

---

## 定制清单（每次同步后重新套用这三处）

### 1. 前端预设文件 `src/config/*ProviderPresets.ts`（共 8 个）

文件：`claude` / `claudeDesktop` / `codex` / `gemini` / `hermes` / `openclaw` /
`opencode` / `universal`。

规则：每个导出的预设数组**只保留**满足下式的项，其余全部删除：

```
name === "One API" || isOfficial === true || category === "official"
```

逐应用保留项：

| 文件 | 保留 |
|------|------|
| claudeProviderPresets | Claude Official · One API |
| claudeDesktopProviderPresets | Claude Desktop Official · One API |
| codexProviderPresets | **仅** OpenAI Official · One API（Azure OpenAI 也删） |
| geminiProviderPresets | Google Official · One API（「自定义」删） |
| hermesProviderPresets | Nous Research（官方）· One API |
| openclawProviderPresets | One API（无官方预设） |
| opencodeProviderPresets | One API（无官方预设） |
| universalProviderPresets | One API（NewAPI、「自定义网关」都删） |

注意事项：

- 删除后要**清理因此空置的本地 helper**，否则 `noUnusedLocals` 会让 `tsc` 报错。
  已知：claudeDesktop 的 `mappedRoutes` / `brandedRoutes`、codex 的本地 `modelCatalog`。
  被 One API 仍引用的 helper（如 claudeDesktop 的 `passthroughRoutes`、codex 的
  `generateThirdPartyAuth` / `generateThirdPartyConfig`）要保留。
- 文件头部的接口、导出常量、导出函数原样保留。
- **上游可能给接口新增字段**（如 v3.16.3 新增了 `primePartner?: boolean`），
  重写时务必保留这些字段声明，否则 `tsc` 会报错。同理 `CLAUDE_DESKTOP_ROLE_ROUTE_IDS`
  可能新增角色（v3.16.3 新增了 `fable`），也要保留。
- `opencodeProviderPresets.ts` 不仅有预设数组，还有 `OPENCODE_PRESET_MODEL_VARIANTS`
  常量和 `getPresetModelDefaults()` 函数——这些是 **模型元数据助手**、被其他文件引用，
  **不是预设**，必须保留。只替换 `export const opencodeProviderPresets` 数组部分。
  同理 `universalProviderPresets.ts` 末尾的 `createUniversalProviderFromPreset()` 等
  工具函数也要保留。

### 2. Rust 种子（全新安装默认就是 官方 + One API、One API 默认启用）

- `src-tauri/src/database/dao/providers.rs`：新增方法 `init_default_oneapi_providers()`，
  给 `claude` / `claude-desktop` / `codex` / `gemini` 各播种一个 One API 供应商，
  并 `set_current_provider` 设为默认激活；由 settings flag `oneapi_providers_seeded`
  保证每个数据库只跑一次。各应用 `settings_config` 形态不同（见 `d1b381cf`）：
  - Claude / Claude Desktop：`env.ANTHROPIC_BASE_URL` + 空 `ANTHROPIC_AUTH_TOKEN`
  - Codex：`auth.OPENAI_API_KEY` + config.toml（custom provider，responses 协议）
  - Gemini：`env.GOOGLE_GEMINI_BASE_URL` + 空 `GEMINI_API_KEY`
- `src-tauri/src/lib.rs`：在 `init_default_official_providers()` 之后调用
  `init_default_oneapi_providers()`。

### 3. 本机数据库（可选，仅影响当前这台机器）

文件：`~/.cc-switch/cc-switch.db`。**改之前务必先关闭 cc-switch 进程**，否则运行中的
应用会在退出时覆盖你的修改。给 `codex` / `gemini` / `claude-desktop` 补一条 One API 行、
设 `is_current=1`，并删掉非「官方/One API」的供应商行。改完重启 app 验证。

---

## 测试

- 上游针对「已删厂商预设」的测试会失败，需要删除或改写，例如：
  `tests/config/codexChatProviderPresets.test.ts`、`therouter*` 系列、
  `mimoTokenPlanPresets.test.ts`、`claudeProviderPresets.test.ts`（只测 AWS Bedrock）等。
- 保留守卫测试 `tests/config/onlyOfficialAndOneApiPresets.test.ts`：断言 8 个清单
  只含「官方 + One API」，谁再加第三方预设会立刻测挂。

> **v3.16.7 实测**：`onlyOfficialAndOneApiPresets.test.ts` 16 项全部通过；
> `therouterOpenCodeOpenClawPresets.test.ts`、`opencodeProviderPresets.test.ts`、
> `codexTemplates.test.ts` 均通过（这些测试适配了精简后的预设清单）。
> `tests/integration/App.test.tsx` 偶有超时失败，与本次定制改动无关（上游也偶发）。

## 改完后的验证（必须本地跑）

```
pnpm install
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest
cd src-tauri && cargo check && cargo test
```

> **注意**：如果 `pnpm install` 后 `pnpm typecheck` 报 esbuild 构建失败，
> 先运行 `pnpm approve-builds esbuild` 再 `pnpm install`，否则 vitest 运行
> 时 esbuild 二进制缺失会导致测试挂掉。

## 发布

推 `win-v*` 标签触发 `.github/workflows/build-windows.yml`，自动构建 Windows + macOS
（unsigned）并发布到 Release。注意：Release 名用标签名，但安装包内嵌版本号取自
`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock`
——若要让安装包版本号也对上，记得先一起 bump 这四处再打标签。

> 版本号建议：在上一次 fork 发布号基础上 +0.0.1。如上游是 v3.16.3、fork 上次是
> v3.16.6，则这次用 v3.16.7。始终比上游同版本号高一点，方便区分定制构建。

## 更省心的长期替代方案（暂未采用）

与其删预设，不如**保留上游完整清单、只在 UI 消费端 `.filter(官方 || One API)`**。
这样上游加再多端点都几乎不冲突，上游测试也全绿。代价是要在每个应用的预设消费点各加
一处过滤。需要时再做。

---

## 同步实录

### v3.17.1（2026-07-18，对应上游 v3.17.0）

- **上游提交数**：160 个（v3.17.0 基线）
- **冲突文件**：13 个
  - 版本号 4 处（统一设为 fork 的 `3.17.1`）
  - 预设 7 处（`universalProviderPresets.ts` 这次是 auto-merge 干净的，
    但**仍然要检查**——上游往里加了 NewAPI/自定义网关，必须重新删掉）
  - 图标 index 1 处（上游新增 `nekocode`，**两个都留**：oneapi + nekocode）
  - `.github/workflows/release.yml` modify/delete → 保持删除（fork 用
    `build-windows.yml`，`release.yml` 是上游的签名发布流程）
  - 测试 3 处 modify/delete（`claudeProviderPresets` / `codexChatProviderPresets` /
    `therouterProviderPresets`）→ 全部 `git rm`
  - `therouterOpenCodeOpenClawPresets.test.ts` 内容冲突 → 取 fork 版
- **上游新增测试**（针对新第三方厂商，需删除）：`doubaoSeedPresets.test.ts`、
  `longcatProviderPresets.test.ts`、`subrouterProviderPresets.test.ts`
- **上游新功能 Grok Build**：`GrokBuildProviderForm` 复用 `codexProviderPresets`
  并过滤掉官方项——所以 fork 下它只剩 One API 一个可选预设。
  `tests/components/GrokBuildProviderForm.test.tsx` 两处要改写：
  - PatewayAI → One API（断言改成 `https://www.oneapi.work/v1` / `One API`）
  - BytePlus 那条「chat_completions」用例：fork 没有 `openai_chat` 形态的 Codex
    预设可点，改成直接单测导出的 `grokApiBackendFromApiFormat()` 映射函数
- **`pnpm-workspace.yaml`**：`allowBuilds.msw` 之前留着占位串 `set this to true
  or false`，会让 `pnpm install` 直接报错，改成 `false`
- **上游接口变化**：`CodexProviderPreset` 新增 `promptCacheRouting?: PromptCacheRoutingMode`
  （重写时保留）；`CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet` 改为 `claude-sonnet-5`（跟上游）
- **验证结果**：
  - `tsc --noEmit`：零错误
  - `vitest`：66 个测试文件 / 428 个测试**全部通过**（含 `App.test.tsx`）
  - 守卫测试 `onlyOfficialAndOneApiPresets.test.ts` 16 项全部通过
  - `cargo check` / `cargo test` **本机未跑**（这台机器没装 Rust 工具链）。
    Rust 定制 #2（providers.rs / lib.rs）auto-merge 干净，已人工确认
    `init_default_oneapi_providers` 和 `oneapi_providers_seeded` 仍在位。
    **发版前请在有 Rust 的机器上补跑，或依赖 CI。**

### v3.16.7（2026-06-19）

- **上游提交数**：47 个（v3.16.3 基线）
- **冲突文件**：13 个
  - 版本号 4 处（`package.json` / `Cargo.toml` / `tauri.conf.json` / `Cargo.lock`）
  - 预设 8 处（全部按本文档重写）
  - 图标 index 1 处（保留 oneapi、删 lemondata）
  - 测试 1 处（`codexChatProviderPresets.test.ts` modify/delete → 删除）
- **上游接口变化**：
  - 多个接口新增 `primePartner?: boolean` 字段（重写时保留）
  - `CLAUDE_DESKTOP_ROLE_ROUTE_IDS` 新增 `fable: "claude-fable-5"`（保留）
- **验证结果**：
  - `tsc --noEmit`：零错误
  - `vitest`：53 个测试文件中 52 个通过
  - 唯一失败是 `App.test.tsx` 超时（预存在问题，非定制引入）
  - 守卫测试 `onlyOfficialAndOneApiPresets.test.ts` 16 项全部通过
- **Rust 定制 #2**：providers.rs 和 lib.rs 均 auto-merge 干净，无需手工干预
