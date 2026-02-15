# 正方体展开图探索 (Cube Net Explorer)

这是一个交互式的正方体展开图学习和探索工具。用户可以在 2D 平面上自由布置正方体的六个面，系统会自动验证其合法性，并以 3D 动画的形式展示从展开图折叠成正方体的全过程。

## 🌟 主要特性

- **交互式 2D 编辑器**：通过简单的拖拽操作在网格中布置正方体的六个面。
- **实时合法性校验**：自动检测当前的布局是否能构成一个有效的正方体（无重叠、连通性检查等）。
- **3D 动态折叠演示**：实时同步 2D 布局到 3D 场景，支持平滑的折叠/展开动画。
- **共享边高亮**：在 2D 和 3D 视图中同时高亮显示折叠后会重合的边缘，帮助理解空间对应关系。
- **经典预设**：内置多种经典的 11 种正方体展开图预设，一键切换。
- **面绘制与标识**：可以在 2D 面上进行简单的标注，并实时反映在 3D 正方体上。

## 🛠️ 技术栈

- **框架**: [React 19](https://react.dev/)
- **3D 渲染**: [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) & [Three.js](https://threejs.org/)
- **手势处理**: [@use-gesture/react](https://use-gesture.netlify.app/)
- **图标**: [Lucide React](https://lucide.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) (建议最新 LTS 版本)
- npm 或 yarn

### 本地运行

1.  **克隆或下载项目**
2.  **安装依赖**:
    ```bash
    npm install
    ```
3.  **启动开发服务器**:
    ```bash
    npm run dev
    ```
4.  **访问**: 打开浏览器访问 `http://localhost:3000`

## 🌐 部署到 Netlify

你可以通过以下几种方式将本项目部署到 Netlify：

### 方法 1：连接 GitHub (推荐)

1.  将代码推送到你的 GitHub 仓库。
2.  登录 [Netlify 控制台](https://app.netlify.com/)。
3.  点击 **Add new site** > **Import an existing project**。
4.  选择你的 GitHub 仓库。
5.  Netlify 会自动识别设置：
    - **Build command**: `npm run build`
    - **Publish directory**: `dist`
6.  点击 **Deploy site**。

### 方法 2：使用 Netlify CLI

1.  安装 CLI: `npm install netlify-cli -g`
2.  构建项目: `npm run build`
3.  部署: `netlify deploy --prod` (发布目录选择 `dist`)

### 方法 3：拖拽上传

1.  在本地运行 `npm run build`。
2.  将生成的 `dist` 文件夹拖拽到 Netlify 控制台的 "Sites" 页面。

## 📖 使用指南

1.  **编辑网格**：在左侧 2D 网格中拖动正方体面来改变布局。
2.  **查看反馈**：如果布局无效，底部会显示错误提示（如“面重叠”或“无法构成正方体”）。
3.  **动画控制**：点击右侧 3D 视图下方的“播放”按钮观察折叠过程，或手动拖动进度条。
4.  **辅助功能**：开启“显示共享边”或“显示面编号”以更好地理解空间结构。
