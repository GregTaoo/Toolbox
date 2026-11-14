# Scanner

一个在浏览器中上传图片、手动校正文档边界并生成扫描件的工具。支持多张图片、拖拽缩略图调整页序、下载单张 WebP 图片或合并为 PDF。

## 运行

需要 Node.js 18.17 或更新版本，以及 pnpm。

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。生产构建使用 `pnpm build`，启动使用 `pnpm start`。

## 使用

1. 拖入或选择图片；拖动预览中的四个角点框选纸张。
2. 按需调整亮度、对比度、黑点和锐化参数，点击「开始处理」。
3. 在上传页或结果页拖拽缩略图调整顺序；PDF 按当前顺序导出。
4. 在结果页下载当前图片或合并后的 PDF。

图片通过本地运行的 `/api/scan` 接口处理；服务端使用 OpenCV 做透视校正、降噪和光照均衡，Sharp 调整影调、锐化并生成 WebP。此项目不提供 OCR 或云端存储。

## 开发检查

```bash
pnpm typecheck
pnpm format:check
```

如需统一格式，运行 `pnpm format`。生成目录、依赖、缓存及本地环境变量已列在 `.gitignore` 中。
