<p align="center">
  <img src="./assets/logo.png" alt="Zylos" height="120">
</p>

<h1 align="center">zylos-browser</h1>

<p align="center">
  <a href="https://github.com/zylos-ai/zylos-core">Zylos</a> 智能体的浏览器自动化组件。
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg" alt="Node.js"></a>
  <a href="https://discord.gg/GS2J39EGff"><img src="https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://x.com/ZylosAI"><img src="https://img.shields.io/badge/X-follow-000000?logo=x&logoColor=white" alt="X"></a>
  <a href="https://zylos.ai"><img src="https://img.shields.io/badge/website-zylos.ai-blue" alt="Website"></a>
  <a href="https://coco.xyz"><img src="https://img.shields.io/badge/Built%20by-Coco-orange" alt="Built by Coco"></a>
</p>

<p align="center">
  <a href="./README.md">English</a>
</p>

---

- **浏览网页** — 你的 AI 智能体可以导航、点击、填表、从任意网站提取内容
- **像人一样感知** — 通过无障碍树快照理解页面结构，告别脆弱的 CSS 选择器
- **从错误中学习** — 按域名存储知识，追踪踩坑记录并自动适应
- **安全设计** — 通过 VNC 登录网站，智能体自动复用你的会话，凭证始终留在你自己的服务器上

## 快速开始

告诉你的 Zylos 智能体：

> "安装 browser 组件"

或使用 CLI：

```bash
zylos add browser
```

Zylos 会引导你完成设置，包括安装 Playwright 浏览器。

## 管理组件

直接告诉你的 Zylos 智能体：

| 操作 | 示例 |
|------|------|
| 截图 | "截一下当前页面" |
| 打开网址 | "用浏览器打开 https://example.com" |
| 查看状态 | "看下浏览器状态" |
| 升级组件 | "升级浏览器组件" |
| 卸载组件 | "卸载浏览器组件" |

或通过 CLI 管理：

```bash
zylos upgrade browser
zylos uninstall browser
```

## 架构

```
zylos-browser（通用工具箱）
    |
    +-- 浏览器控制        导航、点击、输入、截图
    +-- 无障碍树          带元素引用的页面快照
    +-- 站点知识库        按域名存储的交互规则和选择器
    +-- 序列运行器        多步骤工作流自动化
```

平台特定逻辑（Twitter、小红书等）属于各自独立的组件，它们依赖 zylos-browser。

## 文档

- [SKILL.md](./SKILL.md) — 组件规格说明与 CLI 命令
- [CHANGELOG.md](./CHANGELOG.md) — 版本历史

## 参与贡献

请查看[贡献指南](https://github.com/zylos-ai/.github/blob/main/CONTRIBUTING.md)。

## 由 Coco 构建

Zylos 是 [Coco](https://coco.xyz/)（AI 员工平台）的开源核心基础设施。

我们构建 Zylos 是因为我们自己需要它：可靠的基础设施，让 AI 智能体 24/7 稳定运行。每个组件都在 Coco 生产环境中经过实战检验，服务于每天依赖 AI 员工的团队。

想要开箱即用？[Coco](https://coco.xyz/) 提供即开即用的 AI 员工——持久记忆、多渠道沟通、技能包——5 分钟完成部署。

## 许可证

[MIT](./LICENSE)
