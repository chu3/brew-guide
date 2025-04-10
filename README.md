# 咖啡冲泡指南 (Brew Guide)

一个现代化的咖啡冲泡助手应用，帮助咖啡爱好者记录和优化他们的冲泡过程。

Web版（支持PWA）：

- 🔗 （国内） [https://coffee.chu3.top/](http://coffee.chu3.top/)
- 🔗 （海外） [https://brew-guide.vercel.app/](https://brew-guide.vercel.app/)

![版本](https://img.shields.io/badge/版本-1.1.1-blue)

## 功能特点

-   🧰 多种冲泡器具支持 (V60, 聪明杯等)
-   📋 丰富的冲泡方案库
-   ⏱️ 精确的冲泡计时器
-   📊 可视化注水过程
-   📝 详细的冲泡记录
-   🔄 自定义冲泡方案
-   🌓 深色/浅色模式

## 开始使用

首先，运行开发服务器:

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
# 或
bun dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 使用指南

1. 在首页选择您的冲泡器具（如 V60、聪明杯等）
2. 选择合适的冲泡方案或创建自定义方案
3. 按照指导进行注水操作
4. 记录您的冲泡体验和口感评价

## 自定义冲煮方案功能

该应用允许用户为自定义器具创建专属的冲煮方案。主要特点：

1. **自定义方案管理** - 用户可以为每个自定义器具添加多个冲煮方案
2. **器具特性集成** - 方案会根据器具特性（如阀门）自动调整冲煮步骤
3. **自定义注水方式** - 支持基于器具配置的自定义注水动画
4. **本地存储** - 方案数据保存在本地，确保持久化

### 使用流程

1. 创建自定义器具
2. 访问自定义器具的冲煮方案页面
3. 添加新方案，设置参数、阶段和注水方式
4. 保存后即可使用该方案开始冲煮

## 技术栈

-   [Next.js 15](https://nextjs.org/) - React 框架
-   [React 19](https://react.dev/) - 用户界面库
-   [Tailwind CSS 4](https://tailwindcss.com/) - 样式解决方案
-   [Framer Motion](https://www.framer.com/motion/) - 动画库
-   [TypeScript](https://www.typescriptlang.org/) - 类型安全

## 贡献

欢迎提交问题和功能请求！如果您想贡献代码，请先开一个 issue 讨论您想要更改的内容。

## 交流群

欢迎加微信交流群～
![CleanShot 2025-04-07 at 18 29 25](https://github.com/user-attachments/assets/aea1f43a-037a-41dc-b310-b02568d16180)

## 许可

[MIT](https://choosealicense.com/licenses/mit/)

## Learn More

To learn more about Next.js, take a look at the following resources:

-   [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
-   [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# 测试自动部署 - 2025年 4月10日 星期四 15时18分49秒 CST
