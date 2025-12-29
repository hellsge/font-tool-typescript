# TypeScript vs C++ 兼容性测试框架

Binary 级对比，验证 TS 和 C++ 字体转换器输出兼容性。

## 快速开始

```bash
npm run test:compat:gen-cpp   # 生成 C++ 参考
npm run test:compat:gen-ts    # 生成 TS 输出
npm run test:compat:compare   # 执行对比
```

## 测项矩阵 (12 个)

| 测项 | 类型 | 位深 | 字号 | 索引 | Crop |
|------|------|------|------|------|------|
| `bmp_addr_r1` | bitmap | 1 | 32 | address | - |
| `bmp_addr_r2` | bitmap | 2 | 32 | address | - |
| `bmp_addr_r4` | bitmap | 4 | 32 | address | - |
| `bmp_addr_r8` | bitmap | 8 | 32 | address | - |
| `bmp_offset_r1` | bitmap | 1 | 32 | offset | - |
| `bmp_offset_r2` | bitmap | 2 | 32 | offset | - |
| `bmp_offset_r4` | bitmap | 4 | 32 | offset | - |
| `bmp_offset_r8` | bitmap | 8 | 32 | offset | - |
| `bmp_crop_r4` | bitmap | 4 | 32 | address | ✓ |
| `bmp_size19_r2` | bitmap | 2 | 19 | address | - |
| `vec_addr` | vector | - | 32 | address | - |
| `vec_offset` | vector | - | 32 | offset | - |

字符集: a-z (26 字符)

## 验证层次

| 层次 | 要求 |
|------|------|
| Header | 字节相同 |
| Index | 符合规范 |
| CST | 字节相同 |
| Glyph | 允许 5% 差异 |

## 目录结构

```
tests/compatibility/
├── configs/           # 测试配置 JSON
├── cpp_reference/     # C++ 参考输出
├── ts_output/         # TS 输出
├── framework/         # 对比框架
└── reports/           # 测试报告
```
