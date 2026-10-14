import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { exit } from "@tauri-apps/plugin-process";
import { Database, Download, FolderOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FORK_RELEASES_URL } from "@/lib/updater";

interface DatabaseUpgradeProps {
  payload: {
    path?: string;
    error?: string;
    kind?: string;
    db_version?: number;
    supported_version?: number;
  };
}

/**
 * 数据库版本过新（应用过旧）时的恢复界面。
 *
 * 【定制版】应用内更新已彻底关闭（见 src/lib/updater.ts）：本界面不再检查上游
 * 更新源、也不再一键下载安装重启。原因：上游更新包用上游私钥签名，一键升级只会
 * 装上原版并覆盖定制构建。同步上游后若看到 check_app_update_available /
 * install_update_and_restart 的调用，删掉，别合回来。
 *
 * 因此这里只做一件事：引导到本仓库 GitHub Releases 手动下载最新定制安装包。
 */
export function DatabaseUpgrade({ payload }: DatabaseUpgradeProps) {
  const { t } = useTranslation();

  const dbVersion = payload.db_version;
  const supportedVersion = payload.supported_version;

  const openReleases = useCallback(() => {
    void invoke("open_external", { url: FORK_RELEASES_URL });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-border/60 bg-card/80 p-7 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <Database className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">
              {t("dbUpgrade.title", "数据库版本过新")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                "dbUpgrade.description",
                "当前数据库由更新版本的 CC Switch 创建，需要升级应用后才能继续使用。升级不会删除你的数据。",
              )}
            </p>
            {dbVersion != null && supportedVersion != null && (
              <p className="pt-0.5 text-xs text-muted-foreground tabular-nums">
                {t("dbUpgrade.versionInfo", {
                  db: dbVersion,
                  supported: supportedVersion,
                  defaultValue: "数据库版本 v{{db}} · 应用支持 v{{supported}}",
                })}
              </p>
            )}
          </div>
        </div>

        {/* 错误详情 / 数据库路径 */}
        <div className="space-y-1 rounded-lg border border-border/50 bg-muted/40 p-3 text-xs text-muted-foreground">
          {payload.error && (
            <p className="break-words font-mono">{payload.error}</p>
          )}
          {payload.path && (
            <p className="break-all">
              {t("dbUpgrade.dbPath", "数据库文件")}：{payload.path}
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {t("dbUpgrade.manualUpdateTitle", "需手动更新")}
          </p>
          <p className="leading-relaxed">
            {t(
              "dbUpgrade.manualUpdateHint",
              "定制版已关闭应用内更新：请到发布页手动下载并安装最新版本后重试。若已是最新版本仍不兼容，该数据库可能由第三方客户端或更高版本创建。",
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openReleases} className="gap-2">
            <Download className="h-4 w-4" />
            {t("dbUpgrade.downloadLatest", "下载最新版本")}
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => void invoke("open_app_config_folder")}
          >
            <FolderOpen className="h-4 w-4" />
            {t("dbUpgrade.openConfigDir", "打开配置目录")}
          </Button>

          <Button
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={() => void exit(0)}
          >
            {t("dbUpgrade.quit", "退出")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DatabaseUpgrade;
