---
description: "Implement a story — 读取并实现一个开发故事"
mode: agent
agent: cc-orchestrator
---

# 开发故事实现

读取指定的故事文件，加载完整上下文（GDD 需求、ADR 指导、控制清单），路由到正确的程序员代理完成实现和测试。

## 加载技能

严格遵循以下技能文件中的完整工作流：
- [故事开发技能](skills/cc-dev-story/SKILL.md)

> 如果上述链接未自动加载内容，请使用 `read_file` 手动读取对应路径的文件。

## 参数

用户需指定要实现的故事文件路径（如 `production/sprints/sprint-01/stories/STORY-001.md`）。

## 立即开始
