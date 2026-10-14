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
 * 提醒回到约定。改动前请先读 src/lib/updater.ts 与 src-tauri/Cargo.toml 里的
 * 注释（tauri.conf.json 是严格 JSON，写不了注释）。
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

  it("keeps tauri.conf.json strict JSON so the build never regresses", () => {
    // 【事故复盘】2026-10-14 的 v4.0.12 首次构建失败，原因是在本文件里写了
    // `//` 注释：`tauri info` 能容忍 JSONC，但编译期 tauri-build 用严格 JSON
    // 解析器，直接报 "key must be a string"。所以本文件必须能被 JSON.parse 直接
    // 吃掉（不许先剥注释），警告文本改放在支持注释的 src-tauri/Cargo.toml。
    const raw = readFileSync(tauriConfPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw).not.toMatch(/^\s*\/\//m);
    expect(raw).not.toMatch(/\/\*/);
  });

  it("keeps the fork warning where comments are legal", () => {
    // 注释本身也是约定的一部分：专门提醒同步上游的人别把端点合回来。
    const cargoToml = readFileSync(
      path.resolve(__dirname, "../../src-tauri/Cargo.toml"),
      "utf8",
    );
    expect(cargoToml).toMatch(/【定制版】应用内更新已彻底关闭/);
    expect(cargoToml).toMatch(/Jialinvip\/cc-switch\/releases/);
  });
});
