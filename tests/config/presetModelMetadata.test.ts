import { describe, expect, it } from "vitest";

import {
  hermesPresetModelSources,
  openclawPresetModelSources,
} from "@/config/presetModelMetadata";
import { resolveModelMetadata } from "@/lib/modelMetadata";
import type { ModelsDevResponse } from "@/lib/modelsDev";

describe("preset model metadata sources", () => {
  // 【定制版】适配说明：
  // - 上游此处还有「Pi thinking map」用例与 it.each 的 mcode/pi 行，随 Pi /
  //   MiniMax Code 应用一并剥离（见 docs/FORK-定制说明.md）。
  // - 上游的 it.each 还覆盖 codex/opencode，但本 fork 裁剪预设后 codex 只剩
  //   OpenAI Official + One API、且 One API 条目不带 modelCatalog，opencode
  //   同理——那两个来源为空是预期行为，不再断言非空。
  // - 两条按厂商 base URL 取窗口/限额的用例，fixture 从已删厂商（百度千帆 /
  //   Moonshot）换成 One API。

  it.each([
    ["openclaw", openclawPresetModelSources],
    ["hermes", hermesPresetModelSources],
  ])("collects reviewed model values from %s presets", (_app, sources) => {
    const list = sources();
    expect(list.length).toBeGreaterThan(0);
    expect(sources()).toBe(list);
    for (const source of list) {
      expect(source.baseUrl).toBeTruthy();
      expect(source.models.size).toBeGreaterThan(0);
    }
  });

  it("keeps a preset's own window over the vendor default", () => {
    // 预设里手工核实过的窗口优先于 models.dev 的原厂值。
    const modelsDev: ModelsDevResponse = {
      anthropic: {
        api: "https://api.anthropic.com",
        models: {
          "claude-opus-4-8": { limit: { context: 200000 } },
        },
      },
    };
    const resolved = resolveModelMetadata("claude-opus-4-8", {
      baseUrl: "https://www.oneapi.work",
      presets: openclawPresetModelSources(),
      modelsDev,
    });
    expect(resolved?.contextWindow).toBeTruthy();
    expect(resolved?.contextWindow).not.toBe(200000);
  });

  it("reads model limits from the preset for the same address", () => {
    const resolved = resolveModelMetadata("claude-opus-4-8", {
      baseUrl: "https://www.oneapi.work",
      presets: openclawPresetModelSources(),
    });
    // 预设里手工核实过的模型参数能被解析出来。
    expect(resolved?.contextWindow).toBeTruthy();
  });
});
