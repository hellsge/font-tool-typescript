# 贡献指南

感谢您对 TypeScript Font Converter 的关注！我们欢迎各种形式的贡献。

## 开发环境设置

### 前置要求

- Node.js 16.0.0 或更高版本
- npm 或 yarn
- Git

### 克隆仓库

```bash
git clone <repository-url>
cd font-tool-typescript
```

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定类型的测试
npm run test:unit          # Unit tests
npm run test:properties    # Property-based tests
npm run test:integration   # Integration tests
npm run test:compatibility # C++ compatibility tests

# Watch mode（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 开发工作流

### 1. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

### 2. 进行更改

- 遵循现有的代码风格
- 添加测试覆盖新功能
- 更新文档（如果需要）

### 3. 运行代码质量检查

```bash
# Linting
npm run lint

# 自动修复 lint 问题
npm run lint:fix

# 格式化代码
npm run format

# 检查格式
npm run format:check

# 类型检查
npm run typecheck
```

### 4. 提交更改

使用清晰的提交消息：

```bash
git add .
git commit -m "feat: add support for new feature"
```

提交消息格式：
- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `test:` 测试相关
- `refactor:` 代码重构
- `perf:` 性能优化
- `chore:` 构建/工具相关

### 5. 推送并创建 Pull Request

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

## 代码风格

### TypeScript

- 使用 TypeScript strict mode
- 避免使用 `any` 类型
- 为所有 public APIs 提供类型定义
- 使用有意义的变量和函数名

### 格式化

项目使用 Prettier 进行代码格式化：

```bash
npm run format
```

### Linting

项目使用 ESLint：

```bash
npm run lint
```

## 测试指南

### 编写测试

1. **Unit Tests**: 测试单个函数或类
   ```typescript
   describe('BinaryWriter', () => {
     it('should write uint32 in little-endian', () => {
       const writer = new BinaryWriter(4);
       writer.writeUint32LE(0x12345678);
       const buffer = writer.getBuffer();
       expect(buffer[0]).toBe(0x78);
       expect(buffer[1]).toBe(0x56);
       expect(buffer[2]).toBe(0x34);
       expect(buffer[3]).toBe(0x12);
     });
   });
   ```

2. **Property-Based Tests**: 测试通用 properties
   ```typescript
   import fc from 'fast-check';
   
   describe('Property: Config Round-Trip', () => {
     it('should preserve config through JSON serialization', () => {
       fc.assert(
         fc.property(
           fontConfigArbitrary(),
           (config) => {
             const json = JSON.stringify(config);
             const parsed = JSON.parse(json);
             expect(parsed).toEqual(config);
           }
         ),
         { numRuns: 100 }
       );
     });
   });
   ```

3. **Integration Tests**: 测试完整流程
   ```typescript
   describe('E2E: Bitmap Font Generation', () => {
     it('should generate bitmap font from config', async () => {
       const config = loadConfig('examples/bitmap_basic.json');
       await generateFont(config);
       expect(fs.existsSync('output/font.bin')).toBe(true);
     });
   });
   ```

### 测试覆盖率

- 目标：80% 以上（lines, branches, functions, statements）
- 所有新功能必须有测试覆盖
- Property-based tests 应运行最少 100 次迭代

## Pull Request 指南

### PR 检查清单

- [ ] 代码通过所有测试
- [ ] 代码通过 linting 和格式化检查
- [ ] 添加了适当的测试
- [ ] 更新了相关文档
- [ ] 提交消息清晰且有意义
- [ ] PR 描述解释了更改的原因和内容

### PR 描述模板

```markdown
## 更改类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构
- [ ] 文档更新
- [ ] 性能优化

## 描述
简要描述此 PR 的更改内容。

## 相关 Issue
Closes #issue_number

## 测试
描述如何测试这些更改。

## 截图（如适用）
添加截图以帮助解释您的更改。

## 检查清单
- [ ] 我的代码遵循项目的代码风格
- [ ] 我已进行自我审查
- [ ] 我已添加了测试
- [ ] 所有测试都通过
- [ ] 我已更新了文档
```

## 报告 Bug

### Bug 报告模板

```markdown
## Bug 描述
清晰简洁地描述 bug。

## 重现步骤
1. 使用配置 '...'
2. 运行命令 '...'
3. 查看错误

## 期望行为
描述您期望发生什么。

## 实际行为
描述实际发生了什么。

## 环境
- OS: [e.g., Windows 10, macOS 13, Ubuntu 22.04]
- Node.js version: [e.g., 18.0.0]
- Package version: [e.g., 1.0.0]

## 配置文件
```json
{
  // 粘贴您的配置文件
}
```

## 错误日志
```
粘贴错误日志
```

## 额外信息
添加任何其他有关问题的上下文。
```

## 功能请求

### 功能请求模板

```markdown
## 功能描述
清晰简洁地描述您想要的功能。

## 动机
解释为什么需要此功能。它解决了什么问题？

## 建议的解决方案
描述您希望如何实现此功能。

## 替代方案
描述您考虑过的任何替代解决方案或功能。

## 额外信息
添加任何其他上下文或截图。
```

## 发布流程

### 版本号

遵循 [Semantic Versioning](https://semver.org/)：

- **MAJOR**: 不兼容的 API 更改
- **MINOR**: 向后兼容的新功能
- **PATCH**: 向后兼容的 bug 修复

### 发布步骤

1. 更新 `package.json` 中的版本号
2. 更新 `CHANGELOG.md`
3. 提交更改：`git commit -m "chore: release v1.0.0"`
4. 创建标签：`git tag v1.0.0`
5. 推送：`git push && git push --tags`
6. GitHub Actions 将自动发布到 NPM

## 社区准则

### 行为准则

- 尊重所有贡献者
- 欢迎建设性的批评
- 专注于对项目最有利的事情
- 对社区成员表现出同理心

### 沟通

- 使用 GitHub Issues 进行 bug 报告和功能请求
- 使用 GitHub Discussions 进行一般讨论
- 在 PR 中保持专业和建设性

## 获取帮助

如果您需要帮助：

1. 查看 [README.md](README.md) 和文档
2. 搜索现有的 Issues
3. 创建新的 Issue 并详细描述您的问题

## 许可证

通过贡献，您同意您的贡献将在 MIT 许可证下授权。

## 致谢

感谢所有贡献者！您的努力使这个项目变得更好。
