import { getVersion } from "@tauri-apps/api/app";

/**
 * 【定制版开关】应用内更新必须保持关闭。
 *
 * 为什么关：
 * - `src-tauri/tauri.conf.json` 的 updater 端点原本指向上游发布源，签名公钥是
 *   上游作者的 minisign key。走应用内更新只会下载到**原版**安装包，把本仓库的
 *   定制构建覆盖掉。
 * - 本仓库构建的安装包没有上游私钥、无法签出能通过验签的更新包，所以也无法把
 *   端点换成"自己的更新源"来走一键升级。
 *
 * 因此升级方式是：点「下载更新」打开本仓库 GitHub Releases，手动下载安装。
 *
 * 同步上游后请勿把这里改回 true、也不要把 tauri.conf.json 的 updater endpoints
 * 填回去（`tests/config/forkInAppUpdateDisabled.test.ts` 会拦）。确需恢复应用内
 * 更新时，必须先换掉 updater pubkey、用自己的密钥签名发布，并把
 * FORK_RELEASES_URL 与所有安装入口一并梳理。
 */
export const IN_APP_UPDATE_ENABLED = false;

/** 定制版安装包发布页（手动下载入口）。勿指向任何上游下载域名。 */
export const FORK_RELEASES_URL =
  "https://github.com/Jialinvip/cc-switch/releases/latest";

export type UpdateChannel = "stable" | "beta";

export interface UpdateInfo {
  currentVersion: string;
  availableVersion: string;
  notes?: string;
  pubDate?: string;
}

export interface CheckOptions {
  timeout?: number;
  channel?: UpdateChannel;
}

export async function getCurrentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "";
  }
}

export async function checkForUpdate(
  opts: CheckOptions = {},
): Promise<
  { status: "up-to-date" } | { status: "available"; info: UpdateInfo }
> {
  // 定制版：不查任何更新源。永远视为最新，升级引导走 FORK_RELEASES_URL 手动下载。
  if (!IN_APP_UPDATE_ENABLED) {
    return { status: "up-to-date" };
  }

  // 动态引入，避免在未安装插件时导致打包期问题
  const { check } = await import("@tauri-apps/plugin-updater");

  const currentVersion = await getCurrentVersion();
  const update = await check({ timeout: opts.timeout ?? 30000 } as any);

  if (!update) {
    return { status: "up-to-date" };
  }

  const info: UpdateInfo = {
    currentVersion,
    availableVersion: (update as any).version ?? "",
    notes: (update as any).notes,
    pubDate: (update as any).date,
  };

  return { status: "available", info };
}
