# TypeScript vs C++ 兼容性测试框架

二进制级对比机制，用于验证 TypeScript 和 C++ 字体转换器的输出兼容性。

## 快速开始

```bash
# 生成测试数据
npm run test:compat:gen-cpp
npm run test:compat:gen-ts

# 运行快速诊断（30秒）
npm run test:compat:r2

# 运行完整测试（5分钟）
npm run test:compat:full
```

## 目录结构

```
tests/compatibility/
├── framework/           # 核心对比框架
│   ├── comparator.ts           # Binary 对比器
│   ├── header-parser.ts        # Header 解析器
│   ├── index-validator.ts      # Index 验证器
│   ├── report-generator.ts     # 报告生成器
│   └── ...
├── configs/             # 测试配置（11 个）
├── run-cpp.ts          # 生成 C++ 参考
├── run-ts.ts           # 生成 TS 输出
├── compare.ts          # 执行对比
├── run-all.ts          # 完整流程
└── quick-test-r2.ts    # 快速诊断
```

## 验证层次

| 层次 | 验证内容 | 要求 |
|------|----------|------|
| 结构 | Header 字段 | 字节相同 |
| 结构 | Index array | 符合规范 |
| 内容 | .cst 文件 | 字节相同 |
| 渲染 | Glyph 数据 | 允许 5% 差异 |

## 命令

```bash
npm run test:compat:r2        # 快速诊断（30秒）
npm run test:compat:quick     # 快速测试（2分钟）
npm run test:compat:full      # 完整测试（5分钟）
npm run test:compat:gen-cpp   # 生成 C++ 参考
npm run test:compat:gen-ts    # 生成 TS 输出
npm run test:compat:compare   # 执行对比
```

## 测试配置

11 个核心配置，覆盖：
- Bitmap Address mode (1/2/4/8-bit)
- Bitmap Offset mode (1/2/4/8-bit)
- Bitmap Crop mode (2-bit)
- Vector mode (Address/Offset)

所有配置使用 26 个小写字母（a-z）作为测试字符集。

## 核心功能

- **Header 对比**: 字节级对比，逐字段分析
- **Index 验证**: 验证 Address/Offset 模式的 index 结构
- **CST 对比**: 字符集文件字节级对比
- **Binary 分析**: 差异定位、hex dump
- **详细报告**: JSON 报告 + 控制台摘要

## 查看报告

```bash
# JSON 详细报告
cat tests/compatibility/reports/report_*.json

# Windows
type tests\compatibility\reports\report_*.json
```

---

**版本**: 1.0.2  
**日期**: 2025-12-25
