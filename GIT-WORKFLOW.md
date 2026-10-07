# Git 工作流与 GitHub 发布

本文说明星栈酒馆源码仓库的日常 Git 操作、提交范围和发布约定。仓库地址：<https://github.com/FORSTNOVA/xingzhan-tavern>。

## 仓库内容

- `app/`：Android 外壳、内嵌 Node 运行时接入、运行时补丁和原生桥接源码。
- `plugins/`：独立酒馆插件源码。
- `scripts/`：打包、构建、验收和开发辅助脚本。
- `tools/local-sd/`：本地生图桥接源码与说明；编译输出、第三方源码、模型权重不入库。
- 根目录 Markdown：设计方案、用户说明和真机验收记录；验收文档中的结果只代表文档注明的设备、日期和测试范围。
- `vendor/`、`runtime/`：由构建脚本拉取或生成，作为本机缓存使用，不提交。

## 分支与提交

日常开发从最新 `main` 创建短期功能分支。完成后检查变更并提交，再推送分支，通过 GitHub Pull Request 合并。除非维护者明确安排，不直接向 `main` 推送。

```powershell
git switch main
git pull --ff-only
git switch -c codex/简短主题

# 修改完成后检查
git status --short
git diff --check
git diff

git add <需要提交的源码或文档>
git diff --cached --check
git diff --cached --stat
git commit -m "简明说明变更"
git push -u origin HEAD
```

提交应围绕一个清楚的目的，消息使用动词描述结果，例如 `fix: 跳过没有 Git 仓库的本地扩展`、`docs: 整理本地生图桥接说明`。不要把临时日志、个人设置或无关实验混进同一提交。若一个工作区已包含多个独立功能，应拆成多个提交；共享文件的改动先逐段检查再暂存。

## 忽略与发布文件

`.gitignore` 排除了构建目录、下载运行时、依赖缓存、APK、模型文件、打包压缩包、临时截图和本机 Android SDK 路径。不要为了让 Git 显示这些文件而取消忽略规则。

APK 不属于源码提交。需要分发时，在 GitHub Releases 上传经过验证的 APK，并在发布说明中写清版本、设备 ABI、最低 Android 版本和验证范围。模型权重应通过其许可允许的独立渠道提供；不要把模型或大型编译产物推入 Git 历史。GitHub 普通仓库单文件有大小限制；确需版本化的大型源数据应先评估 Git LFS 的成本和必要性。

## 凭据与用户数据

- 不提交 `.env`、`local.properties`、API 密钥、访问令牌、签名密钥、真实用户配置、聊天记录、日志或私有角色卡。
- 使用本机未跟踪配置或环境变量保存凭据；示例和测试只用虚构值，并明确标注为 mock。
- 提交前检查新增文件、差异和大文件：

```powershell
git status --short --untracked-files=all
git diff --cached --check
git diff --cached
git ls-files --stage
git check-ignore -v <文件路径>
```

若密钥曾经进入 Git 历史，仅删除当前文件并不能撤销泄露；应先撤销/轮换凭据，再按仓库安全流程处理历史。

## 同步远端

推送前先确认当前分支和远端：

```powershell
git branch --show-current
git remote -v
git fetch origin
git status -sb
```

功能分支可在确认工作区干净后通过 `git rebase origin/main` 更新。共享分支不要强推；需要修正已推送提交时优先追加修复提交。推送失败时先检查网络、凭据和远端分支状态，不要通过删除远端分支或强制覆盖来绕过冲突。

## 构建与提交前验证

Windows 开发机可按 README 的本机准备步骤配置 Android SDK/JDK，然后执行：

```powershell
node --check app/src/main/assets/android-patches.mjs
.\gradlew.bat :app:assembleDebug
```

涉及 TTS、生图、Android 系统能力或扩展更新时，按对应验收文档执行范围明确的测试。真实 API 调用、真实模型下载和真机操作会产生外部副作用；测试记录应说明实际调用范围，不能用构建成功替代实机验证。

## 发布检查

1. `git status` 中只保留本次要发布的源码和文档。
2. 确认构建目录、APK、模型、密钥、个人数据没有被暂存。
3. 运行适用的构建/测试并查看失败原因。
4. 检查提交差异与提交信息，再推送功能分支。
5. PR 描述列明行为变化、验证设备/方式、未覆盖范围和已知限制。
6. 合并后如需发布 APK，单独创建 GitHub Release；不要把 APK 追加进源码提交。
