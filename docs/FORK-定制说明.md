# Fork 定制说明：只保留「官方端点 + One API」

> 本文档仅适用于本 fork（`Jialinvip/cc-switch`），用于记录相对上游
> `farion1231/cc-switch` 的定制改动，方便每次同步上游后**重新套用**。
>
> 参考提交：`d1b381cf "OneAPI"`。

## 一句话目标

每个应用的供应商清单**只保留两个端点**：该应用的「官方端点」和「One API」，
并让 **One API 默认启用**。上游频繁新增的第三方厂商端点一律不要。

## 维护策略：当补丁重打，别跟上游 merge 硬解冲突

上游几乎每次更新都在改这些预设文件。**不要**去逐行解决 merge 冲突，
而是：**先把 fork 同步成干净的上游（=完整上游），再把下面三件事重新套用一遍。**

```
git fetch upstream
git merge upstream/main        # 或 GitHub "Sync fork"，取完整上游
# 然后重新套用本文档的三处定制
```

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

## 改完后的验证（必须本地跑）

```
pnpm install
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest
cd src-tauri && cargo check && cargo test
```

## 发布

推 `win-v*` 标签触发 `.github/workflows/build-windows.yml`，自动构建 Windows + macOS
（unsigned）并发布到 Release。注意：Release 名用标签名，但安装包内嵌版本号取自
`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`——若要让安装包
版本号也对上，记得先一起 bump 这三处再打标签。

## 更省心的长期替代方案（暂未采用）

与其删预设，不如**保留上游完整清单、只在 UI 消费端 `.filter(官方 || One API)`**。
这样上游加再多端点都几乎不冲突，上游测试也全绿。代价是要在每个应用的预设消费点各加
一处过滤。需要时再做。
