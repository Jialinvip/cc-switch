import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 业务约束：定制版已彻底关闭应用内更新。
 *
 * 背景：`src-tauri/tauri.conf.json` 的 updater 端点原本指向上游发布源
 * （dl.ccswitch.io / oneapi.work），签名公钥也是上游的 minisign key。端点一旦
 * 恢复，应用就会提示升级，且一键升级会装上原版、覆盖掉定制构建。
 *
 * 同步上游后若把 updater endpoints / 更新签名产物加回来，会让这些用例失败，
 * 提醒回到约定。改动前请先读 src/lib/updater.ts 与 tauri.conf.json 里的注释。
 */

/** 去掉 JSONC 的 `//` 行注释（字符串内的 `//` 不受影响），再交给 JSON.parse。 */
function stripJsonComments(source: string): string {
  let inString = false;
  let escaped = false;
  let out = "";
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      if (i < source.length) out += "\n";
      continue;
    }
    out += ch;
  }
  return out;
}

const tauriConfPath = path.resolve(
  __dirname,
  "../../src-tauri/tauri.conf.json",
);
const tauriConf = JSON.parse(
  stripJsonComments(readFileSync(tauriConfPath, "utf8")),
) as {
  bundle?: { createUpdaterArtifacts?: boolean };
  plugins?: { updater?: { endpoints?: unknown; pubkey?: unknown } };
};

describe("fork: tauri updater feed stays disconnected", () => {
  it("keeps updater endpoints empty so no upstream release can be discovered", () => {
    expect(tauriConf.plugins?.updater?.endpoints).toEqual([]);
  });

  it("does not build updater artifacts", () => {
    expect(tauriConf.bundle?.createUpdaterArtifacts).toBe(false);
  });

  it("has no leftover upstream update host anywhere in the updater config", () => {
    const updaterConfig = JSON.stringify(tauriConf.plugins?.updater ?? {});
    expect(updaterConfig).not.toMatch(/dl\.ccswitch\.io|oneapi\.work|farion1231/);
  });

  it("keeps the fork warning comment so a sync cannot silently re-enable it", () => {
    // 注释本身也是约定的一部分：它写在 tauri.conf.json 的 updater 块上方，
    // 专门提醒同步上游的人别把端点合回来。
    const raw = readFileSync(tauriConfPath, "utf8");
    expect(raw).toMatch(/【定制版】应用内更新已彻底关闭/);
    expect(raw).toMatch(/Jialinvip\/cc-switch\/releases/);
  });
});
