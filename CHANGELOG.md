# 更新日志

## [3.1.1] - 2026-04-27

点阵字体低 bit 模式字形纵向对齐修复。

### 修复
- 修复 1/2/4-bit 模式下部分字形纵向偏移 1px 的问题（ghost row）
  - tight bbox 裁剪改用与 renderMode 打包一致的可见性阈值
  - bearingX/bearingY 改为从实际渲染像素位置反算，确保与打包后可见内容一致
- 修复 `examples/honeygui_test.json` 中相对路径错误

### 新增
- `ImageProcessor.getVisibilityThreshold(renderMode)` 方法
- `scripts/pack-deploy.bat` 打包便捷脚本
- `scripts/gen-honeygui-test.bat` honeygui 测试字库生成脚本

---

## [3.1.0] - 2026-04-16

矢量字体功能增强 — V3 header 补充 `unitsPerEm`，空格字形支持。

### 新增
- V3 vector header extension：追加 `unitsPerEm`（uint16, 2 字节）于 fontName 之后，消费端可获取字体设计单位用于排版计算
- 空格字形 (U+0020) 支持：无轮廓但有 advance 的字形（如空格）现在生成 advance-only glyph data entry（bbox 全零 + windingCount=0 + 有效 advance），消费端可正确获取空格宽度
- `fontSize` 前置校验：矢量生成器在 `generate()` 入口校验 `fontSize > 0`，不合法时抛出 `CONFIG_VALIDATION_ERROR`
- `unitsPerEm` 校验：`createHeader()` 校验 `unitsPerEm > 0`，无效时抛出 `FONT_PARSE_ERROR`
- `VectorFontHeader.fromBytes()` 兼容读取：version[0] >= 3 时读取 `unitsPerEm`，低版本默认 0

### 变更
- `VectorFontHeader.length` 计算包含 V3 extension（+2 字节）
- `extractGlyph()` 不再跳过无轮廓字形，改为判断 `outline.contours.length === 0` 时生成 advance-only entry

### 测试
- `header_properties.test.ts`：property-based test 适配 `unitsPerEm` 字段，验证 round-trip 和 header length 计算
- `vector_generator_basic.test.ts`：新增 validation 测试组（fontSize 校验）和 space glyph 测试组（ADDRESS/OFFSET 模式、纯空格字符集）
- 新增测试字体 `Font/NotoSans-Bold.ttf`

---

## [3.0.0] - 2026-03-24

点阵字体字形标准化重构 — V2 bearing-based tight bbox 格式。
V1 的 fit-in-box canvas 模型（4 字节 glyph header + 固定 canvas 像素）替换为
V2 的 bearing-based 紧凑存储（6 字节 glyph header + tight bbox 像素），
header extension 追加 typography metrics 供消费端排版。

### Breaking Changes
- Bitmap header 版本号跟随 tool 版本：`{1,0,2}` → `{3,0,0,0}`（4 字节 version，从 package.json 同步）
- `font_size` 字段语义变更：V1 backSize → V2 em-size（= 用户 fontSize，不缩小）
- V2 强制 crop（bearing-based 紧凑存储），`crop` 配置项对 V2 无效
- `bitmap-generator.ts` 重构：移除 fit-in-box 缩放逻辑（`scaledFontSize`/`calculateRecalculatedSize`），`renderGlyph` → `processGlyph`，`rasterizePathImproved` → `rasterizePath`
- 移除 `BitmapGlyphData` interface

### 新增
- V2 per-glyph header（6 字节）：bearingX/bearingY/width/height/advance/reserved，替代 V1 的 4 字节 [xOffset/topSkip, yOffset, charWidth, charHeight] 格式
- tight bbox 像素存储：仅存字形实际覆盖区域，不再填充固定 canvas
- V2 header extension：ascender/descender/lineGap/unitsPerEm（8 字节，追加在 font_name 之后）
- `calculateStandardDimensions()`：renderSize = fontSize，backSize = ceil(fontSize × (asc-desc) / upm)
- `BinaryWriter.writeGlyphHeaderV2()`：bearing-based glyph header 序列化
- `BitmapFontHeader.fromBytes()` 兼容 V1/V2 两种 header 读取

### 变更
- 5 个测试文件适配 V2 header layout
- 新增 `tests/v2_header.test.ts`（V2 header round-trip 测试）
- 矢量字体模块未变更

---

## [2.0.2] - 2026-03-06

### 修复
- 矢量字体曲线展平 tolerance 错误：使用固定 tolerance=1.0，但坐标为原始字体单位（unitsPerEm=2048），导致曲线过度细分
  - 字符"3"展平后产生 286 个点，超过 `windingLengths` 的 `uint8` 上限（255），截断为 30，字形数据错位导致显示异常
  - 修复：按 C++ `stbtt_FlattenCurves` 公式计算 flatness = `1.0 / (scale * renderMode)`，与 C++ 输出对齐
  - 副作用：.bin 文件体积显著减小（冗余点被消除）

---

## [2.0.1] - 2026-03-05

### 修复
- Bitmap glyph header `char_w`/`char_h` 计算错误：使用 clamp 后的 `drawX`/`posY` 替代原始 `slotLeft`/未 clamp 值
  - 对负 left bearing 字符（如 "j"）影响显著：`slotLeft=-2` 时 `char_w` 少了 2 像素，导致消费端按错误 stride 读取 bitmap 数据
  - `posOX`/`posOY` 在上一版已修复，本次补齐 `char_w`/`char_h`

### 测试
- `cpp_compatibility.test.ts`：版本号期望从 C++ 1.0.2/0.0.0 更新为 TS 2.0.x
- `cli_exit_codes.test.ts`：无效参数测试改用缺少 `fontPath` 字段（`renderMode: 3` 被 parse 阶段静默回退为默认值）
- `e2e_integration.test.ts`：无效配置测试改用 `fontSize: 999`（超出 MAX_FONT_SIZE）

---

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
