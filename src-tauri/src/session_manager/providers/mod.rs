mod blocks;
pub mod claude;
pub mod codex;
mod codex_items;
pub mod gemini;
pub mod grokbuild;
pub mod hermes;
pub mod openclaw;
pub mod opencode;
mod opencode_blocks;
// 【定制版】文件名带 pi 是上游命名遗留：它服务 Pi **与 OpenClaw** 的同构 JSONL
// 记录→block 映射（见文件头注释）。Pi 应用已剥离，但 OpenClaw 仍依赖此模块，
// 按「共享助手整文件保留」约定留下，勿随同步上游或去 pi 清理一并删除。
mod pi_blocks;
mod utils;
