# 更新日志

## [2.0.0] - 2026-02-04

### 重大版本升级
TypeScript 实现已超越 C++ 参考实现，成为主要开发版本。

### 新增 (since 1.0.0)
- 完整的 Bitmap 字体生成 (1/2/4/8-bit render modes)
- 完整的 Vector 字体生成 (contour data)
- RVD (Render Vector Data) 模式支持
- Crop 模式空间优化
- 2-bit/4-bit 抗锯齿：4x 超采样 + box filter 降采样
- 兼容性测试框架 `tests/compatibility/`
- 资源文件本地化：`Font/`, `charset/`, `CodePage/`

### 兼容性状态
- ✅ Bitmap + Address (r1/r2/r4/r8)
- ✅ Bitmap + Offset (r1/r2/r4/r8)
- ✅ Bitmap + Crop
- ✅ Vector 基础功能

### 已知限制
- 矢量字体去重叠需使用 fonttools 预处理（JS 多边形库精度不足）

### 预处理重叠字体
```bash
fonttools subset input.ttf --output-file=output.ttf --unicodes="*" --overlaps-backend=pathops --remove-overlaps
```

---

## [1.0.4] - 2025-01-30

### 移除
- 矢量字体去重叠功能：JS 多边形库无法正确处理字体轮廓重叠

## [1.0.3] - 2025-12-30

### 变更
- 资源文件本地化：`Font/`, `charset/`, `CodePage/` 移入 TS 仓库
- 测试路径更新：移除对 `font-tool-release` 的依赖
- README 简化兼容性测试说明

### 修复
- 兼容性测试配置路径修正

## [1.0.2] - 2025-12-29

### 修复
- 2-bit/4-bit 抗锯齿：4x 超采样 + box filter 降采样
- Offset Mode Index：只存 unicode (2B)，下标即 glyphIndex
- 字号缩放 (Fit-in-Box)：backSize/scaledFontSize 分离
- 基线对齐：非 crop 模式下字形按基线定位
- Crop 模式：Canvas 渲染 + Glyph Header 格式修正

### 新增
- `scripts/pack-release.js` - 打包核心源码为 release 压缩包
- 兼容性测试框架 `tests/compatibility/`
- rvd 模式支持 (Render Vector Data)

### 变更
- README 重构：完整 CLI 参数、配置字段说明
- 测试配置完善：bmp_addr_r4, bmp_crop_r4 等用例

### 兼容性
- ✅ Bitmap + Address (r1/r2/r4/r8)
- ✅ Bitmap + Offset (r1/r2/r4/r8)
- ✅ Bitmap + Crop
- 🔲 Vector (Index size 待修复)

## [1.0.1] - 2025-12-25

### 修复
- property-based tests 竞态条件问题
- 错误清理测试稳定性
- 目录创建和路径处理测试

### 变更
- README 文档更新
- 配置验证错误消息改进
- 测试套件性能优化

### 移除
- 冗余文档文件（CONTRIBUTING.md, IMPLEMENTATION_STATUS.md）

## [1.0.0] - 2025-12-25

### 新增
- TypeScript 字体转换器初始版本
- Bitmap 字体生成 (1/2/4/8-bit render modes)
- Vector 字体生成 (contour data)
- 字符集处理：.cst 文件、CodePage、Unicode range、字符串
- 文本效果：粗体、斜体、旋转 (0°/90°/180°/270°)、gamma 校正
- Crop 模式空间优化
- 索引方式：Address mode (65536 entries) / Offset mode (N entries)
- 跨平台支持 (Windows/macOS/Linux)
- Binary format 兼容 C++ 实现 (v1.0.2)
- CLI 参数覆盖支持
- INI 配置文件支持 (gamma/rotation)
- 自动创建输出目录
- NotSupportedChars.txt 生成

### 测试
- 单元测试
- Property-based tests (fast-check, 100+ iterations)
- 集成测试
- 兼容性测试
- 80%+ 代码覆盖率
