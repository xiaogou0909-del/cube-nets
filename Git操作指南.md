
# Git 操作指南

这是一份为初学者准备的详细操作指南，包含代码上传、常见问题解决等内容。

## 快速操作流程

### 1. 检查当前修改
```bash
git status
```
**功能**：查看哪些文件有变更，红色表示未暂存，绿色表示已暂存

### 2. 暂存修改
```bash
# 方式一：暂存所有变更（简单但谨慎使用）
git add .

# 方式二：选择特定文件（推荐）
git add 文件名1 文件名2
```

### 3. 提交暂存区的修改
```bash
git commit -m "说明信息"
```
**提交信息格式建议**：
- `feat: 添加新功能` - 新增功能
- `fix: 修复bug` - 修复问题
- `refactor: 重构代码` - 优化代码结构
- `style: 调整样式` - 只修改样式
- `docs: 更新文档` - 只修改文档

**示例**：
```bash
git commit -m "fix: 修复撤销按钮失效的问题"
git commit -m "feat: 添加移动端响应式支持"
```

### 4. 推送到远程仓库
```bash
# 推送到 main 分支（GitHub 默认分支）
git push origin main
```

---

## 完整操作流程实例

假设你修改了 `App.tsx` 和 `components/NetEditor.tsx`：

### 步骤 1：检查状态
```bash
git status
```
**预期输出**：
```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git checkout -- <file>..." to discard changes in working directory)

    modified:   App.tsx
    modified:   components/NetEditor.tsx
```

### 步骤 2：暂存文件
```bash
git add App.tsx components/NetEditor.tsx
```

### 步骤 3：提交
```bash
git commit -m "feat: 重构工具栏布局"
```

### 步骤 4：推送
```bash
git push origin main
```

---

## 常用命令速查表

| 命令 | 功能描述 | 适用场景 |
|------|----------|----------|
| `git status` | 查看当前状态 | 常用，每次操作前建议检查 |
| `git diff` | 查看变更内容 | 需要查看具体修改内容时 |
| `git add` | 暂存文件 | 准备提交前 |
| `git commit` | 提交暂存区 | 保存本地修改 |
| `git push` | 推送到远程 | 将本地提交发送到 GitHub |
| `git pull` | 拉取远程代码 | 本地代码过时或需要同步远程 |
| `git log --oneline` | 查看简洁的提交历史 | 查看项目开发历程 |
| `git log` | 查看完整的提交历史 | 需要详细了解提交信息 |

---

## 常见问题及解决方法

### 问题 1：推送失败 - 远程仓库有更新
```
! [rejected]        main -> main (fetch first)
error: failed to push some refs to 'https://github.com/your-username/your-repo.git'
```

**解决方法**：
```bash
# 先拉取远程仓库的最新代码（自动合并）
git pull origin main

# 检查合并是否成功
git status

# 成功后再次推送
git push origin main
```

### 问题 2：不小心提交了不需要的文件
```bash
# 情况1：已暂存但未提交，取消暂存
git reset HEAD 文件名

# 情况2：已提交，撤销提交（保留修改）
git reset HEAD~1 --mixed

# 情况3：丢弃未暂存的修改（谨慎使用）
git checkout -- 文件名
```

### 问题 3：代码冲突
**场景**：多人同时修改了同一处代码

**解决方法**：
1. 运行 `git status` 查看冲突文件
2. 打开文件查看冲突标记 `<<<<<<< HEAD` 和 `>>>>>>> origin/main`
3. 手动修复冲突（保留你需要的代码）
4. 暂存修复后的文件：`git add 文件名`
5. 提交：`git commit -m "resolve: 解决冲突"`
6. 再次推送：`git push origin main`

### 问题 4：查看特定文件的变更历史
```bash
# 查看文件的所有提交记录
git log --oneline 文件名

# 查看某个提交中文件的具体变更
git show 提交ID:文件名
```

---

## 项目开发建议

### 1. 保持工作区整洁
```bash
# 定期检查并移除未跟踪的临时文件
git status
# 对于不需要追踪的文件，添加到 .gitignore
```

### 2. 编写有意义的提交信息
```bash
# 好的提交信息
git commit -m "refactor: 优化绘制工具栏布局，减少垂直空间占用"

# 不好的提交信息（太模糊）
git commit -m "修改了一下代码"
```

### 3. 定期同步
```bash
# 每天开发前先拉取最新代码
git pull origin main

# 完成功能后及时提交和推送
git add .
git commit -m "feat: 完成xxx功能"
git push origin main
```

### 4. 分支管理（进阶）
```bash
# 创建新分支
git branch feature/new-function

# 切换到新分支
git checkout feature/new-function

# 或者合并上面两步
git checkout -b feature/new-function

# 分支开发完成后，合并到 main 分支
git checkout main
git pull origin main
git merge feature/new-function

# 推送到远程
git push origin main

# 删除本地分支
git branch -d feature/new-function

# 删除远程分支
git push origin --delete feature/new-function
```

---

## 配置说明

### 首次使用 Git 配置
```bash
# 配置用户名（GitHub 用户名）
git config --global user.name "你的 GitHub 用户名"

# 配置邮箱（GitHub 邮箱）
git config --global user.email "你的邮箱地址"

# 配置默认分支
git config --global init.defaultBranch main
```

### 查看当前配置
```bash
git config --list
```

---

## 学习资源

- **官方文档**：https://git-scm.com/docs/user-manual.html
- **可视化工具**：GitHub Desktop（推荐）、SourceTree
- **学习网站**：https://learngitbranching.js.org/（交互式学习）

记住：Git 学习需要实践，遇到问题多尝试，慢慢就会熟悉！
