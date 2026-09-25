import { describe, expect, it } from "vitest";
import { generateThirdPartyConfig } from "./codexProviderPresets";

// fork 裁剪后 codex 预设只剩 OpenAI Official + One API，无 requiresOAuth
// 托管卡，原「OAuth presets never declare the auth.json fallback」快照用例
// 随第三方预设一并移除；保留模板函数的 keyless 闸门断言。
describe("codexProviderPresets managed OAuth snapshots", () => {
  it("key-based third-party template keeps the fallback flag by default", () => {
    expect(
      generateThirdPartyConfig("acme", "https://api.acme.dev/v1", "m1"),
    ).toContain("requires_openai_auth = true");
  });
});
