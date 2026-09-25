import { describe, expect, it } from "vitest";

import {
  getPiModelCatalogReference,
  piModelCatalog,
} from "@/config/piModelCatalog";
import { piProviderPresets } from "@/config/piProviderPresets";
import {
  isPiThinkingLevelMap,
  PI_THINKING_LEVELS,
  piThinkingBindings,
  piThinkingProfiles,
  resolvePiThinkingProfile,
} from "@/config/piThinkingProfiles";

describe("Pi thinking profiles", () => {
  it("keeps valid, non-empty native maps", () => {
    for (const profile of Object.values(piThinkingProfiles)) {
      expect(isPiThinkingLevelMap(profile.map)).toBe(true);
      expect(Object.keys(profile.map).length).toBeGreaterThan(0);
      expect(
        Object.keys(profile.map).every((key) =>
          PI_THINKING_LEVELS.includes(
            key as (typeof PI_THINKING_LEVELS)[number],
          ),
        ),
      ).toBe(true);
    }
  });

  it("uses only explicit catalog and API bindings", () => {
    for (const binding of piThinkingBindings) {
      expect(resolvePiThinkingProfile(binding)).toEqual({
        profileId: binding.profileId,
        map: { ...piThinkingProfiles[binding.profileId].map },
        ...(binding.modelCompat
          ? { modelCompat: { ...binding.modelCompat } }
          : {}),
      });
      expect(
        resolvePiThinkingProfile({
          ...binding,
          api:
            binding.api === "openai-responses"
              ? "openai-completions"
              : "openai-responses",
        }),
      ).toBeUndefined();
    }
  });

  it("materializes preset-local profiles without serializing references", () => {
    const materialized = [];
    for (const preset of piProviderPresets) {
      for (const model of preset.settingsConfig.models) {
        if (!model.thinkingLevelMap) continue;
        const reference = getPiModelCatalogReference(model);
        materialized.push({
          preset: preset.name,
          modelId: model.id,
          profileId: reference?.presetThinkingProfileId,
          map: model.thinkingLevelMap,
        });
        expect(reference).toBeDefined();
        expect(piModelCatalog).toHaveProperty(reference!.catalogKey);
        expect(JSON.parse(JSON.stringify(model))).not.toHaveProperty(
          "presetThinkingProfileId",
        );
      }
    }

    // fork 裁剪后 pi 预设只剩 One API（显式 thinkingProfile 走
    // getPiThinkingProfile，避免绑定注入 compat 影响 mcode 派生）。
    expect(materialized).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          preset: "One API",
          modelId: "claude-opus-4-8",
          profileId: "xhighAndMax",
        }),
      ]),
    );
  });

  it("gives every reasoning preset an explicit map", () => {
    for (const preset of piProviderPresets) {
      for (const model of preset.settingsConfig.models) {
        if (!model.reasoning) continue;
        expect(model).toHaveProperty("thinkingLevelMap");
        expect(isPiThinkingLevelMap(model.thinkingLevelMap)).toBe(true);
      }
    }
  });

  it("pairs Anthropic adaptive maps with Pi's required compatibility flag", () => {
    // 绑定层：声明 forceAdaptiveThinking 的绑定必须能解析出非空 map + compat。
    const adaptiveBindings = piThinkingBindings.filter(
      (binding) => binding.modelCompat?.forceAdaptiveThinking === true,
    );
    expect(adaptiveBindings.length).toBeGreaterThan(0);
    for (const binding of adaptiveBindings) {
      const resolved = resolvePiThinkingProfile(binding);
      expect(resolved?.modelCompat).toMatchObject({
        forceAdaptiveThinking: true,
      });
      expect(Object.keys(resolved?.map ?? {}).length).toBeGreaterThan(0);
    }

    // fork 不变量：pi 预设模型不带 compat（mcode 派生过滤器要求无 compat）。
    for (const preset of piProviderPresets) {
      for (const model of preset.settingsConfig.models) {
        expect(model.compat, preset.name).toBeUndefined();
      }
    }
  });

  it("does not add a generic binding for host-sensitive model families", () => {
    expect(
      piThinkingBindings.some((binding) =>
        /^(deepseek|zai|moonshotai)\//.test(binding.catalogKey),
      ),
    ).toBe(false);
  });
});
