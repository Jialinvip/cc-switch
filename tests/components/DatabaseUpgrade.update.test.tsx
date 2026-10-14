import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

/**
 * 定制版约束：数据库版本过新的恢复界面不得再一键下载安装更新——那条链路装的是
 * 原版安装包，会覆盖定制构建。只能引导到本仓库 GitHub Releases 手动下载。
 */

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  exit: vi.fn(async () => undefined),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { DatabaseUpgrade } from "@/components/DatabaseUpgrade";
import { FORK_RELEASES_URL } from "@/lib/updater";

const payload = {
  path: "C:/data/cc-switch.db",
  error: "database disk image is malformed",
  kind: "db-version-too-new",
  db_version: 42,
  supported_version: 41,
};

describe("DatabaseUpgrade (fork: in-app updates disabled)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it("does not probe or install in-app updates", async () => {
    render(<DatabaseUpgrade payload={payload} />);

    // 给挂载副作用留出一拍
    await Promise.resolve();

    const commands = invokeMock.mock.calls.map(([cmd]) => cmd);
    expect(commands).not.toContain("check_app_update_available");
    expect(commands).not.toContain("install_update_and_restart");
  });

  it("routes the upgrade action to the fork's GitHub Releases", async () => {
    render(<DatabaseUpgrade payload={payload} />);

    const downloadButton = screen.getByRole("button", {
      name: /dbUpgrade\.(downloadLatest|upgradeNow)/,
    });
    fireEvent.click(downloadButton);

    expect(invokeMock).toHaveBeenCalledWith("open_external", {
      url: FORK_RELEASES_URL,
    });
    expect(invokeMock).not.toHaveBeenCalledWith("install_update_and_restart");
  });

  it("explains that updates are manual rather than claiming upgrade cannot help", () => {
    render(<DatabaseUpgrade payload={payload} />);

    expect(
      screen.queryByText(/dbUpgrade\.incompatibleTitle/),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/dbUpgrade\.manualUpdateHint/)).toBeInTheDocument();
  });
});
