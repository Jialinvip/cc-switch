/**
 * Hermes Agent provider presets configuration
 * Hermes uses custom_providers array in config.yaml
 */
import type { ProviderCategory } from "../types";
import type { PresetTheme, TemplateValueConfig } from "./claudeProviderPresets";

export const HERMES_PROVIDER_SOURCE_FIELD = "_cc_source";
export const HERMES_PROVIDER_SOURCE_CUSTOM_LIST = "custom_providers";
export const HERMES_PROVIDER_SOURCE_DICT = "providers_dict";

export function isHermesReadOnlyProvider(settingsConfig: unknown): boolean {
  if (!settingsConfig || typeof settingsConfig !== "object") {
    return false;
  }
  const marker = (settingsConfig as Record<string, unknown>)[
    HERMES_PROVIDER_SOURCE_FIELD
  ];
  return marker === HERMES_PROVIDER_SOURCE_DICT;
}

export interface HermesModel {
  id: string;
  name?: string;
  context_length?: number;
}

export interface HermesSuggestedDefaults {
  model: {
    default: string;
    provider?: string;
  };
}

export type HermesApiMode =
  | "chat_completions"
  | "anthropic_messages"
  | "codex_responses"
  | "bedrock_converse";

export const HERMES_DEFAULT_API_MODE: HermesApiMode = "chat_completions";

export const hermesApiModes: Array<{
  value: HermesApiMode;
  labelKey: string;
}> = [
  { value: "chat_completions", labelKey: "hermes.form.apiModeChatCompletions" },
  {
    value: "anthropic_messages",
    labelKey: "hermes.form.apiModeAnthropicMessages",
  },
  { value: "codex_responses", labelKey: "hermes.form.apiModeCodexResponses" },
  {
    value: "bedrock_converse",
    labelKey: "hermes.form.apiModeBedrockConverse",
  },
];

export interface HermesProviderPreset {
  name: string;
  nameKey?: string;
  websiteUrl: string;
  apiKeyUrl?: string;
  settingsConfig: HermesProviderSettingsConfig;
  isOfficial?: boolean;
  isPartner?: boolean;
  primePartner?: boolean;
  partnerPromotionKey?: string;
  category?: ProviderCategory;
  templateValues?: Record<string, TemplateValueConfig>;
  theme?: PresetTheme;
  icon?: string;
  iconColor?: string;
  isCustomTemplate?: boolean;
  suggestedDefaults?: HermesSuggestedDefaults;
}

export interface HermesProviderSettingsConfig {
  name: string;
  base_url?: string;
  api_key?: string;
  api_mode?: HermesApiMode;
  models?: HermesModel[];
  rate_limit_delay?: number;
  [key: string]: unknown;
}

export const hermesProviderPresets: HermesProviderPreset[] = [
  {
    name: "Nous Research",
    websiteUrl: "https://nousresearch.com",
    apiKeyUrl: "https://portal.nousresearch.com/",
    settingsConfig: {
      name: "nous",
      base_url: "https://inference-api.nousresearch.com/v1",
      api_key: "",
      api_mode: "chat_completions",
      models: [
        {
          id: "Hermes-4-405B",
          name: "Hermes 4 405B",
          context_length: 131072,
        },
        {
          id: "Hermes-4-70B",
          name: "Hermes 4 70B",
          context_length: 131072,
        },
      ],
    },
    isOfficial: true,
    category: "official",
    icon: "hermes",
    iconColor: "#7C3AED",
    suggestedDefaults: {
      model: { default: "Hermes-4-405B", provider: "nous" },
    },
  },
  {
    name: "One API",
    websiteUrl: "https://www.oneapi.work",
    apiKeyUrl: "https://www.oneapi.work",
    settingsConfig: {
      name: "oneapi",
      base_url: "https://www.oneapi.work/v1",
      api_key: "",
      api_mode: "chat_completions",
      models: [{ id: "gpt-5.5", name: "GPT-5.5" }],
    },
    category: "aggregator",
    icon: "oneapi",
    suggestedDefaults: {
      model: { default: "gpt-5.5", provider: "oneapi" },
    },
  },
];
