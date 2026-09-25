import { describe, expect, it } from "vitest";
import { codexProviderPresets } from "@/config/codexProviderPresets";

// 预填口径（2026-08-15 官方文档盘点 + Jason 同日拍板"表单可见性优先"）：
// - native Responses 直连预设：填厂商官方声明的真实差异化档位子集；
// - Chat 路由预设（supportsEffort:false）：档位值不进 wire，仅当预设声明了
//   真实思考开关（supportsThinking + thinkingParam）时填两态 none/high；
// 后端 codex_canonical_efforts 对未知值静默丢弃——预设里的拼写错误不会报错，
// 只会让 Codex 选择器静默少档/错档，所以白名单校验必须在测试层兜住。
//（fork 裁剪预设后，逐厂商档位明细用例已随第三方预设一并移除。）
const CANONICAL_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
];

describe("Codex preset pre-filled reasoning levels", () => {
  it("only ever declares canonical Codex efforts", () => {
    for (const preset of codexProviderPresets) {
      for (const model of preset.modelCatalog ?? []) {
        for (const level of model.reasoningLevels ?? []) {
          expect(
            CANONICAL_EFFORTS,
            `${preset.name}/${model.model} level "${level}"`,
          ).toContain(level);
        }
        if (model.defaultReasoningLevel !== undefined) {
          expect(model.reasoningLevels ?? []).toContain(
            model.defaultReasoningLevel,
          );
        }
      }
    }
  });
});
