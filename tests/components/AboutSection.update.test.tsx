import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

/**
 * 定制版约束：应用内更新已关闭。
 * - 「下载更新」必须跳到本仓库 GitHub Releases 手动下载。
 * - 即便上游报出新版（hasUpdate=true），也不得出现一键安装入口 ——
 *   installUpdateAndRestart 装的是原版安装包，会覆盖定制构建。
 */

const openExternalMock = vi.fn();
const installUpdateAndRestartMock = vi.fn();
const checkUpdatesMock = vi.fn();

let useUpdateState: {
  hasUpdate: boolean;
  updateInfo: { availableVersion: string; notes?: string } | null;
};

vi.mock("@/lib/api", () => ({
  settingsApi: {
    openExternal: (...args: unknown[]) => openExternalMock(...args),
    installUpdateAndRestart: (...args: unknown[]) =>
      installUpdateAndRestartMock(...args),
    checkUpdates: (...args: unknown[]) => checkUpdatesMock(...args),
    getToolVersions: vi.fn(async () => []),
    probeToolInstallations: vi.fn(async () => []),
    runToolLifecycleAction: vi.fn(async () => undefined),
    getLogConfig: vi.fn(async () => ({ enabled: false, level: "info" })),
    isPortable: vi.fn(async () => false),
  },
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(async () => "3.20.6"),
}));

vi.mock("@/contexts/UpdateContext", () => ({
  useUpdate: () => ({
    hasUpdate: useUpdateState.hasUpdate,
    updateInfo: useUpdateState.updateInfo,
    isChecking: false,
    isDismissed: false,
    error: null,
    dismissUpdate: vi.fn(),
    checkUpdate: vi.fn(async () => false),
    resetDismiss: vi.fn(),
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/platform", () => ({ isWindows: () => true }));

vi.mock("framer-motion", () => {
  const cache: Record<string, unknown> = {};
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        if (!cache[tag]) {
          const HostTag = tag;
          cache[tag] = ({
            children,
            initial,
            animate,
            exit,
            transition,
            whileHover,
            whileTap,
            layout,
            ...rest
          }: any) => <HostTag {...rest}>{children}</HostTag>;
          (cache[tag] as any).displayName = `motion.${tag}`;
        }
        return cache[tag];
      },
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

vi.mock("@/assets/icons/app-icon.png", () => ({ default: "app-icon.png" }));

// 上游新增的「What's New」弹窗依赖 settings 上下文，与更新链路无关，替换成空壳。
vi.mock("@/components/WhatsNewDialog", () => ({
  WhatsNewDialog: () => null,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/components/settings/ToolUpgradeConfirmDialog", () => ({
  ToolUpgradeConfirmDialog: () => null,
}));
vi.mock("@/components/settings/ToolInstallRow", () => ({
  ToolInstallRow: () => null,
}));

import { AboutSection } from "@/components/settings/AboutSection";
import { FORK_RELEASES_URL } from "@/lib/updater";

describe("AboutSection update entry (fork: in-app updates disabled)", () => {
  beforeEach(() => {
    openExternalMock.mockReset().mockResolvedValue(undefined);
    installUpdateAndRestartMock.mockReset();
    checkUpdatesMock.mockReset();
    useUpdateState = { hasUpdate: false, updateInfo: null };
  });

  it("sends the download button to the fork's GitHub Releases", async () => {
    render(<AboutSection isPortable={false} />);

    const button = await screen.findByRole("button", {
      name: /settings\.downloadUpdate/,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(openExternalMock).toHaveBeenCalledWith(FORK_RELEASES_URL);
    });
    expect(installUpdateAndRestartMock).not.toHaveBeenCalled();
    expect(checkUpdatesMock).not.toHaveBeenCalled();
  });

  it("never offers an in-app install, even when an update is advertised", async () => {
    useUpdateState = {
      hasUpdate: true,
      updateInfo: { availableVersion: "9.9.9", notes: "upstream release" },
    };
    render(<AboutSection isPortable={false} />);

    expect(
      screen.queryByRole("button", { name: /settings\.updateTo/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /settings\.updating/ }),
    ).not.toBeInTheDocument();
    // 升级提示卡片同样不允许出现：它会把用户引向装原版。
    expect(screen.queryByText(/settings\.updateAvailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/upstream release/)).not.toBeInTheDocument();

    const button = screen.getByRole("button", {
      name: /settings\.downloadUpdate/,
    });
    fireEvent.click(button);
    await waitFor(() => {
      expect(openExternalMock).toHaveBeenCalledWith(FORK_RELEASES_URL);
    });
    expect(installUpdateAndRestartMock).not.toHaveBeenCalled();
  });
});
