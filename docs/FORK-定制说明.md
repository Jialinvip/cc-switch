# Fork 定制说明：只保留「官方端点 + One API」

> 本文档仅适用于本 fork（`Jialinvip/cc-switch`），用于记录相对上游
> `farion1231/cc-switch` 的定制改动，方便每次同步上游后**重新套用**。
>
> 参考提交：`d1b381cf "OneAPI"`（初版定制）、`fc6070ba`（v3.16.7 同步）。

## 一句话目标

每个应用的供应商清单**只保留两个端点**：该应用的「官方端点」和「One API」，
并让 **One API 默认启用**。上游频繁新增的第三方厂商端点一律不要。

**应用标签（App Switcher 标签页）固定为现有 8 个**：`claude` / `claude-desktop` /
`codex` / `gemini` / `grokbuild` / `opencode` / `openclaw` / `hermes`。
上游再新增受管应用（如 Pi、MiniMax Code）**一律不要接入**，也不要在
`AppId` / `APP_IDS` / `DEFAULT_VISIBLE_APPS` 等清单里加回。

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

> **注意**：上游可能**新增预设文件**（如 v3.20 新增 `grokBuildProviderPresets.ts` /
> `piProviderPresets.ts` / `mcodeProviderPresets.ts`）。这些文件没有冲突、会随 merge
> 干净进入 fork，**必须对照下方定制清单同样裁剪 + 补 One API**，并把新清单加进
> `tests/config/onlyOfficialAndOneApiPresets.test.ts` 守卫。同理若上游新增
> `src/config/*.test.ts` 同目录测试（测第三方厂商的）要删或改写。

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
| grokBuildProviderPresets | Grok Official · One API |
| piProviderPresets | One API（无官方预设） |
| mcodeProviderPresets | One API（**从 pi 派生**，勿手改数组；保证 pi 的 One API 无 compat 即可） |

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
- `grokBuildProviderPresets.ts` 有独立的 `grokBuildOfficialPreset` 导出（在数组外，
  后端 `providers_seed.rs` 的 "Grok Official" 与之对应），裁剪数组即可，官方条目别动。
  One API 条目用 `grokPresetConfig("One API", "https://www.oneapi.work/v1")` 生成。
- `piProviderPresets.ts` 的 One API 条目给 `claude-opus-4.8` 显式
  `thinkingProfile: "xhighAndMax"`，防止 `materializeVerifiedThinkingProfiles`
  按绑定注入 `forceAdaptiveThinking` compat——否则 mcode 派生过滤器
  （要求所有 model 无 compat）会把整个 One API 条目滤掉。
- `mcodeProviderPresets.ts` 是 `piProviderPresets` 的运行时派生
  （filter + map），**不要手改其数组**；pi 的 One API 条目 `api` 用
  `anthropic-messages`（属 `MCODE_API_FORMATS`）即可自动流入 mcode。
- `piModelCatalog.ts` / `piThinkingProfiles.ts` 是模型元数据/思考档位助手，
  与 `OPENCODE_PRESET_MODEL_VARIANTS` 同类，整文件保留。
- 新应用（Grok Build / Pi / Mcode）**尚未加 Rust One API 种子**（与 v3.17.1
  对 Grok Build 的处理一致）；种子里 `settings_config` 形态逐应用不同，需要时
  再单独评估。

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

### v3.20.5+（2026-09-26）删除 Pi / MiniMax Code 应用标签

- **动机**：应用切换器只保留现有 8 个标签；Pi 与 MiniMax Code 是上游 v3.20.x
  新增的受管应用，本 fork 不接入。**后续同步上游时也不要再新增应用标签。**
- **前端删除**（`AppId` / `VisibleApps` / usage `AppType` 不再含 `pi`/`mcode`）：
  - 清单：`APP_IDS`、`DEFAULT_VISIBLE_APPS`、`SKILLS_APP_IDS`、`ADDITIVE_APP_IDS`、
    `MCP_APP_IDS`、`APP_ICON_MAP`、`AppSwitcher`、`AppVisibilitySettings`、
    `AboutSection` 工具卡、`DirectorySettings` 等
  - 专属文件整删：`PiProviderForm` / `McodeProviderForm` / `PiPromptPanel` /
    `PiNativePromptResources` / `piProviderPresets` / `mcodeProviderPresets` /
    `piModelCatalog` / `piThinkingProfiles` / `piPromptSlug` / `piPromptTemplate` /
    `lib/api/pi.ts` / `lib/query/pi.ts` 及对应测试
  - 共享文件去掉 pi/mcode 分支：`App.tsx`、`ProviderForm`、`ProviderList`、
    `Add/EditProviderDialog`、`mutations.ts`、`UnifiedSkillsPanel`、`PromptPanel` 等
- **Rust**：为保持编译兼容与数据库行可反序列化，**暂保留** `AppType::Pi` /
  `AppType::Mcode` 枚举变体与既有 match 臂（含 `pi_config`/`mcode_config` 等
  专属模块）。前端已不再产生 `pi`/`mcode` 的 `AppId`，UI 上两个标签已消失。
  若日后上游继续膨胀这两套后端，可再做一次 Rust 侧彻底剥离。
- **不删**：MiniMax **厂商**相关（`codingPlanProviders` 的 minimax、定价
  `minimax-m*`、`minimax` 图标、模型目录条目）——那是 API 供应商，不是
  MiniMax Code 应用。其它应用代码一概不动。
- **验证**：`tsc --noEmit` 零错误；`pnpm test:unit` **118 个测试文件 / 841 个测试全部通过**
  （Rust 本机无 cargo，靠 CI）。

### v3.20.5（2026-09-25，对应上游 v3.20.4）

- **上游提交数**：360 个（v3.20.4 基线，merge 时 upstream/main 在 v3.20.4+8）
- **冲突文件**：23 个
  - 版本号 4 处（统一设为 fork 的 `3.20.5`）
  - 预设 7 处 modify/modify（`universalProviderPresets.ts` 又一次 auto-merge 干净，
    仍要检查；本次上游给它加的内容都在裁剪范围内）
  - 其余两个内容冲突 `src/App.tsx`、`src/components/settings/AboutSection.tsx` → 跟上游
  - `.github/workflows/release.yml` modify/delete → 保持删除
  - 测试 7 处 modify/delete（claude/codexChat/doubao/longcat/mimo/subrouter/therouter
    系列）→ 全部 `git rm`
  - `therouterOpenCodeOpenClawPresets.test.ts`、`opencodeProviderPresets.test.ts`
    取 fork 版 + gemini-3.5-flash → 3.6-flash 改名
  - `GrokBuildProviderForm.test.tsx` 内容冲突 → 取上游版再改 PatewayAI → One API
- **上游新增 3 个预设清单**（本表此前未覆盖，本次按「官方 + One API」一并裁剪）：
  `grokBuildProviderPresets.ts` / `piProviderPresets.ts` / `mcodeProviderPresets.ts`
  - grokBuild 保留 `grokBuildOfficialPreset` + 新增 One API 条目
  - pi 只留 One API（新增，`api: "anthropic-messages"`、opus 显式
    `thinkingProfile: "xhighAndMax"` 防 compat 注入）
  - mcode 由 pi 派生，自动得到 One API（守卫测试覆盖）
  - `piModelCatalog.ts` / `piThinkingProfiles.ts` 作为元数据助手整文件保留
- **上游接口/助手保留**：`OPENCODE_PRESET_MODEL_VARIANTS`（gemini-3.5-flash 已被
  上游客改名为 gemini-3.6-flash，断言跟着改）、`getPresetModelDefaults`、
  `createUniversalProviderFromPreset`、codex 的 `generateThirdPartyAuth/Config`、
  claudeDesktop 的 `passthroughRoutes` 等均保留；删掉空置的 `mappedRoutes` /
  `brandedRoutes` / codex 本地 `modelCatalog` / `MIMO_CODEX_BASE_INSTRUCTIONS` /
  `OPENROUTER_STYLE_GROK_MODEL` / pi 的六个 COMPAT 常量
- **上游新增测试的处理**：
  - 删（测已删厂商）：`jiekou`/`ppio`/`codexProviderPresets.tokenPlanTextOnly`/
    `qianfanTokenPlan`/`tokenPlanProvider`/`xaiOauthProvider`/`piProviderPresets` 等
    预设清单测试，及 `claudeProviderPresets`/`codexChatProviderPresets`/`therouter*`
    等 modify/delete 冲突项
  - 改写（fixture 从已删厂商换成 One API）：`PiProviderForm`（Kimi/DeepSeek→One API）、
    `McodeProviderForm`（MiniMax→One API）、`ClaudeDesktopProviderForm`（PackyCode→One API）、
    `piThinkingProfiles`（materialize/adaptive 两用例改断言 + 加 fork 不变量
    「pi 模型不带 compat」）
  - 裁剪：`codexReasoningLevelPresets.test.ts` 只留 canonical efforts 白名单守卫；
    `src/config/codexProviderPresets.test.ts` 只留 `generateThirdPartyConfig` 用例
  - `opencodeProviderPresets.test.ts` Bedrock variants 断言跟上游模型改名
    （opus-4-8 → global.anthropic.claude-opus-5）
- **守卫测试扩展**：`onlyOfficialAndOneApiPresets.test.ts` 从 8 组扩到 11 组
  （加 grokbuild / pi / mcode），22 项断言全过
- **验证结果**：
  - `tsc --noEmit`：零错误
  - `vitest`：126 个测试文件 / 956 个测试**全部通过**（含 `App.test.tsx`）
  - 守卫测试 22 项全过
  - `cargo check` / `cargo test` **本机未跑**（无 Rust 工具链）。Rust 定制 #2
    auto-merge 干净，已人工确认 `init_default_oneapi_providers`（7 个种子齐全）
    和 `oneapi_providers_seeded` 仍在位、调用顺序在官方种子之后。
    **发版前请在有 Rust 的机器上补跑，或依赖 CI。**

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
