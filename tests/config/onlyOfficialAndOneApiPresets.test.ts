import { describe, expect, it } from "vitest";
import { providerPresets } from "@/config/claudeProviderPresets";
import { claudeDesktopProviderPresets } from "@/config/claudeDesktopProviderPresets";
import { codexProviderPresets } from "@/config/codexProviderPresets";
import { geminiProviderPresets } from "@/config/geminiProviderPresets";
import { hermesProviderPresets } from "@/config/hermesProviderPresets";
import { openclawProviderPresets } from "@/config/openclawProviderPresets";
import { opencodeProviderPresets } from "@/config/opencodeProviderPresets";
import { universalProviderPresets } from "@/config/universalProviderPresets";

/**
 * 业务约束：每个应用的预设清单只保留「官方端点 + One API」。
 * 新增第三方厂商预设会让这些用例失败，提醒回到约定。
 */
const presetLists: Array<[string, ReadonlyArray<{ name: string }>]> = [
  ["claude", providerPresets],
  ["claude-desktop", claudeDesktopProviderPresets],
  ["codex", codexProviderPresets],
  ["gemini", geminiProviderPresets],
  ["hermes", hermesProviderPresets],
  ["openclaw", openclawProviderPresets],
  ["opencode", opencodeProviderPresets],
  ["universal", universalProviderPresets],
];

const isOfficialOrOneApi = (preset: {
  name: string;
  isOfficial?: boolean;
  category?: string;
}): boolean =>
  preset.name === "One API" ||
  preset.isOfficial === true ||
  preset.category === "official";

describe("provider presets are limited to official + One API", () => {
  it.each(presetLists)("%s only exposes official and One API", (_app, list) => {
    for (const preset of list) {
      expect(
        isOfficialOrOneApi(preset),
        `unexpected preset "${preset.name}"`,
      ).toBe(true);
    }
  });

  it.each(presetLists)("%s includes the One API preset", (_app, list) => {
    expect(list.some((preset) => preset.name === "One API")).toBe(true);
  });
});
