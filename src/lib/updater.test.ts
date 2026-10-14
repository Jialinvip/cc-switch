import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FORK_RELEASES_URL,
  IN_APP_UPDATE_ENABLED,
  checkForUpdate,
  getCurrentVersion,
} from "@/lib/updater";

/**
 * 定制版约束：应用内更新必须保持关闭。
 *
 * 打开更新检查会让应用比对上游 latest.json，一键升级会把定制构建覆盖成原版
 * （上游更新包用上游私钥签名，只能是原版）。同步上游后若这条链路被恢复，
 * 下面的用例会失败，提醒回到约定。
 */
describe("fork: in-app update is disabled", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exports IN_APP_UPDATE_ENABLED === false", () => {
    expect(IN_APP_UPDATE_ENABLED).toBe(false);
  });

  it("always reports up-to-date without touching the network", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("update check must not reach the network");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await checkForUpdate();

    expect(result).toEqual({ status: "up-to-date" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports up-to-date even when a newer version is advertised upstream", async () => {
    // 即便上游后来报出更高的版本号，定制版也不得提示升级。
    const result = await checkForUpdate({ timeout: 1 });

    expect(result.status).toBe("up-to-date");
  });

  it("points manual downloads at the fork's own GitHub Releases", () => {
    expect(FORK_RELEASES_URL).toBe(
      "https://github.com/Jialinvip/cc-switch/releases/latest",
    );
    // 上游更新源不得作为下载入口，否则会把用户引导去装原版。
    expect(FORK_RELEASES_URL).not.toMatch(/dl\.ccswitch\.io|oneapi\.work/);
  });

  it("keeps getCurrentVersion harmless in non-Tauri environments", async () => {
    await expect(getCurrentVersion()).resolves.toBeTypeOf("string");
  });
});
