import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  Github,
  Globe,
  Info,
  Loader2,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { getVersion } from "@tauri-apps/api/app";
import { settingsApi } from "@/lib/api";
import { useUpdate } from "@/contexts/UpdateContext";
import { Badge } from "@/components/ui/badge";
import { WhatsNewDialog } from "@/components/WhatsNewDialog";
import { WHATS_NEW_ENTRIES, entriesUpTo } from "@/lib/whatsNew";
import appIcon from "@/assets/icons/app-icon.png";
// 【定制版】应用内更新已关闭，升级只走 FORK_RELEASES_URL 手动下载。见 src/lib/updater.ts。
import { FORK_RELEASES_URL } from "@/lib/updater";

interface AboutSectionProps {
  isPortable: boolean;
}

// 应用自身版本（getVersion，本地毫秒级、无网络）也缓存一份，纯为重挂时免去 loading 闪烁。
let appVersionCache: string | null = null;

// 邀 Star 条关掉后记在本机（纯界面偏好，不进库、不随云同步）
const STAR_PROMPT_DISMISSED_KEY = "ccswitch:about:starPromptDismissed";

function readStarPromptDismissed(): boolean {
  try {
    return localStorage.getItem(STAR_PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 设置 → 关于：版本、便携模式、检查更新 / 安装并重启、项目链接。
 * 命令行应用的安装与升级在侧栏「应用」页。
 */
export function AboutSection({ isPortable }: AboutSectionProps) {
  const { t } = useTranslation();
  // 惰性初始化自模块缓存：重挂时首帧即渲染上次的值，避免 loading 闪烁；首次挂载缓存
  // 为空则回退到原始初值（null / loading）。
  const [version, setVersion] = useState<string | null>(() => appVersionCache);
  const [isLoadingVersion, setIsLoadingVersion] = useState(
    () => appVersionCache === null,
  );
  // 【定制版】应用内更新已关闭，升级只走手动下载（见 src/lib/updater.ts）。
  // 这里曾经有 isDownloading 等一键安装状态，勿再恢复：installUpdateAndRestart
  // 装的是上游签名的原版安装包，会覆盖定制构建。
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [starPromptDismissed, setStarPromptDismissed] = useState(
    readStarPromptDismissed,
  );
  const recentEntries = useMemo(
    () => (version ? entriesUpTo(WHATS_NEW_ENTRIES, version) : []),
    [version],
  );

  // 仅保留 updateInfo：「更新日志」要展示当前/目标版本号。其余更新状态不再使用。
  const { updateInfo } = useUpdate();

  useEffect(() => {
    let active = true;
    const loadAppVersion = async () => {
      try {
        const appVersion = await getVersion();
        appVersionCache = appVersion;
        if (active) {
          setVersion(appVersion);
        }
      } catch (error) {
        console.error("[AboutSection] Failed to load app version", error);
        if (active) {
          setVersion(null);
        }
      } finally {
        if (active) {
          setIsLoadingVersion(false);
        }
      }
    };

    void loadAppVersion();
    return () => {
      active = false;
    };
  }, []);

  const handleOpenReleaseNotes = useCallback(async () => {
    try {
      const targetVersion = updateInfo?.availableVersion ?? version ?? "";
      const displayVersion = targetVersion.startsWith("v")
        ? targetVersion
        : targetVersion
          ? `v${targetVersion}`
          : "";

      if (!displayVersion) {
        await settingsApi.openExternal("https://www.oneapi.work/releases");
        return;
      }

      await settingsApi.openExternal(
        `https://www.oneapi.work/releases/tag/${displayVersion}`,
      );
    } catch (error) {
      console.error("[AboutSection] Failed to open release notes", error);
      toast.error(t("settings.openReleaseNotesFailed"));
    }
  }, [t, updateInfo?.availableVersion, version]);

  const handleOpenGithub = useCallback(() => {
    void settingsApi.openExternal("https://www.oneapi.work/");
  }, []);

  const handleDismissStarPrompt = useCallback(() => {
    setStarPromptDismissed(true);
    try {
      localStorage.setItem(STAR_PROMPT_DISMISSED_KEY, "1");
    } catch {
      // 存不下就只在本次会话里隐藏
    }
  }, []);

  /**
   * 【定制版】升级只走手动下载。
   *
   * 这里曾经是「检查更新 → installUpdateAndRestart 一键下载安装」。恢复那条链路
   * 会把定制构建覆盖成原版（上游更新包用上游私钥签名，只能是原版），详见
   * src/lib/updater.ts。同步上游后若看到 installUpdateAndRestart / checkUpdates
   * 的调用，删掉，别合回来。
   */
  const handleDownloadUpdate = useCallback(async () => {
    try {
      await settingsApi.openExternal(FORK_RELEASES_URL);
    } catch (error) {
      console.error("[AboutSection] Failed to open releases page", error);
      toast.error(t("settings.openReleaseNotesFailed"));
    }
  }, [t]);

  const displayVersion = version ?? t("common.unknown");

  return (
    <div className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <img src={appIcon} alt="" className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-title text-fg-1">CC Switch</div>
          <div className="flex flex-wrap items-center gap-2 text-caption text-fg-2">
            {isLoadingVersion ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="tabular-nums">{`${t("common.version")} v${displayVersion}`}</span>
            )}
            {isPortable && (
              <Badge
                variant="secondary"
                className="gap-1 px-1.5 py-0 text-badge"
              >
                <Info className="h-3 w-3" />
                {t("settings.portableMode")}
              </Badge>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="neutral"
          size="regular"
          onClick={handleDownloadUpdate}
        >
          <Download className="h-3.5 w-3.5" />
          {t("settings.downloadUpdate")}
        </Button>
      </div>

      {/* 【定制版】此处原有「检测到新版本」升级提示卡片。应用内更新已关闭，
          展示该卡片只会把用户引向装原版，故移除；勿随上游同步合回来。 */}

      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        {starPromptDismissed && (
          <Button
            type="button"
            variant="neutral"
            size="compact"
            onClick={handleOpenGithub}
          >
            <Github className="h-3.5 w-3.5" />
            {t("settings.github")}
          </Button>
        )}
        <Button
          type="button"
          variant="neutral"
          size="compact"
          onClick={() => settingsApi.openExternal("https://www.gptvip.cn")}
        >
          <Globe className="h-3.5 w-3.5" />
          {t("settings.officialWebsite")}
        </Button>
        <Button
          type="button"
          variant="neutral"
          size="compact"
          onClick={handleOpenReleaseNotes}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t("settings.releaseNotes")}
        </Button>
        {recentEntries.length > 0 && (
          <Button
            type="button"
            variant="neutral"
            size="compact"
            onClick={() => setWhatsNewOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("whatsNew.recentTitle")}
          </Button>
        )}
      </div>

      {/* 下载与更新都走 ccswitch.io，用户不再经过仓库页，邀 Star 单独占一行；按钮即 GitHub 入口。
          关掉后链接行补回 GitHub 按钮 */}
      {!starPromptDismissed && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-action-soft py-3.5 ps-5 pe-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Star
              aria-hidden="true"
              className="h-5 w-5 shrink-0 animate-[spin_6s_linear_infinite] fill-amber-500 text-amber-500 motion-reduce:animate-none"
            />
            <p className="min-w-0 text-body text-fg-1">
              {t("settings.starPrompt")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="neutral"
              size="compact"
              onClick={handleOpenGithub}
            >
              <Github className="h-3.5 w-3.5" />
              {t("settings.starOnGithub")}
            </Button>
            <Button
              type="button"
              variant="quiet"
              size="icon-compact"
              onClick={handleDismissStarPrompt}
              aria-label={t("common.close")}
              title={t("common.close")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <WhatsNewDialog
        open={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
        entries={recentEntries}
      />
    </div>
  );
}
