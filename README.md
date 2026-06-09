# zj-rrissh.github.io

个人博客前端，基于 Vite + React + TypeScript。

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 发布到 GitHub Pages

这个仓库是 `zj-rrissh.github.io`，Vite 的默认 `/` 路径可以直接用于用户主页。

1. 在 GitHub 仓库页面进入 `Settings -> Pages`。
2. 将 `Build and deployment` 的 `Source` 设为 `GitHub Actions`。
3. 推送到 `main` 分支后，`.github/workflows/deploy.yml` 会自动构建并发布 `dist`。
4. 发布完成后访问 `https://zj-rrissh.github.io/`。
