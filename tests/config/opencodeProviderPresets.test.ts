import { describe, expect, it } from "vitest";
import {
  opencodeNpmPackages,
  opencodeProviderPresets,
  OPENCODE_PRESET_MODEL_VARIANTS,
} from "@/config/opencodeProviderPresets";

describe("OpenCode preset model metadata", () => {
  it("should include @ai-sdk/amazon-bedrock in npm packages", () => {
    const bedrockPkg = opencodeNpmPackages.find(
      (p) => p.value === "@ai-sdk/amazon-bedrock",
    );
    expect(bedrockPkg).toBeDefined();
    expect(bedrockPkg!.label).toBe("Amazon Bedrock");
  });

  it("should include Bedrock model variants", () => {
    const variants = OPENCODE_PRESET_MODEL_VARIANTS["@ai-sdk/amazon-bedrock"];
    expect(variants).toBeDefined();
    expect(variants.length).toBeGreaterThan(0);

    const opusModel = variants.find((v) =>
      v.id.includes("claude-opus-5"),
    );
    expect(opusModel).toBeDefined();
  });
});

describe("OpenCode preset reasoning flags", () => {
  // OpenCode 只给 reasoning 为真的模型生成思考档位；CC Switch 写的供应商 key
  // 对不上 models.dev，不写就一个档位都没有。
  const models = opencodeProviderPresets.flatMap((preset) =>
    Object.entries(preset.settingsConfig.models ?? {}).map(([id, model]) => ({
      preset: preset.name,
      id,
      model,
    })),
  );

  // 【定制版】上游此处还有一条「Claude / GPT / DeepSeek V4 标记为 reasoning」
  // 用例，断言的是上游第三方厂商预设的模型；本 fork 裁剪后只剩 One API 条目、
  // 且其模型刻意不写 reasoning（由 models.dev 推断），故不再断言。
  it("keeps reasoning off when a model's thinking is turned off", () => {
    for (const { preset, id, model } of models) {
      const thinking = (model.options as { thinking?: { type?: string } })
        ?.thinking;
      if (thinking?.type === "disabled") {
        expect(model.reasoning, `${preset} / ${id}`).not.toBe(true);
      }
    }
    expect(models.length).toBeGreaterThan(0);
  });
});
