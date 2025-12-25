# TypeScript Font Converter

一个面向嵌入式系统的字体转换工具，将 TrueType 字体（.ttf, .ttc）转换为优化的 binary 格式。

## 特性

- **Bitmap Fonts**: 支持 1-bit、2-bit、4-bit 和 8-bit 灰度渲染
- **Vector Fonts**: 基于轮廓的可缩放字体
- **字符编码**: 支持 CodePage 文件、Unicode ranges 和自定义字符集
- **文本效果**: 粗体、斜体、旋转（0°, 90°, 180°, 270°）、gamma 校正
- **空间优化**: Character cropping mode 减少文件大小
- **索引方法**: Address mode（65536 entries）或 Offset mode（N entries）
- **跨平台**: 支持 Windows、macOS 和 Linux
- **Binary 兼容性**: 与 C++ 实现（version 1.0.2）保持字节级兼容

## 安装

### 前置要求

- Node.js 16.0.0 或更高版本
- npm 或 yarn

### 从 NPM 安装

```bash
npm install -g @font-tools/converter-ts
```

### 从源码安装

```bash
git clone <repository-url>
cd font-tool-typescript
npm install
npm run build
npm link
```

## 使用方法

### 基本用法

```bash
# 使用配置文件
font-converter config.json

# 使用 CLI 参数覆盖配置
font-converter config.json --size 24 --bold --output ./output
```

### CLI 参数

```
Usage: font-converter [options] <config>

Arguments:
  config                    JSON 配置文件路径

Options:
  -V, --version            输出版本号
  -s, --size <number>      字体大小（覆盖配置）
  -b, --bold               启用粗体
  -i, --italic             启用斜体
  -r, --render-mode <mode> Render mode: 1, 2, 4, 或 8 bits
  -o, --output <path>      输出目录路径
  --rotation <degrees>     旋转角度: 0, 90, 180, 或 270
  -h, --help               显示帮助信息
```

### 配置文件格式

#### 基本 Bitmap 配置

```json
{
  "fonts": [
    {
      "fontPath": "fonts/Arial.ttf",
      "outputPath": "output/",
      "fontSize": 16,
      "renderMode": 4,
      "bold": false,
      "italic": false,
      "rotation": 0,
      "gamma": 1.0,
      "indexMethod": 0,
      "crop": false,
      "outputFormat": "bitmap",
      "characterSets": [
        {
          "type": "range",
          "value": "0x0020-0x007F"
        }
      ]
    }
  ]
}
```

#### 基本 Vector 配置

```json
{
  "fonts": [
    {
      "fontPath": "fonts/Arial.ttf",
      "outputPath": "output/",
      "fontSize": 16,
      "outputFormat": "vector",
      "indexMethod": 0,
      "characterSets": [
        {
          "type": "file",
          "value": "charset/basic.cst"
        }
      ]
    }
  ]
}
```

#### 高级配置示例

```json
{
  "fonts": [
    {
      "fontPath": "fonts/NotoSansSC.ttf",
      "outputPath": "output/chinese/",
      "fontSize": 24,
      "renderMode": 8,
      "bold": true,
      "italic": false,
      "rotation": 0,
      "gamma": 1.2,
      "indexMethod": 1,
      "crop": false,
      "outputFormat": "bitmap",
      "characterSets": [
        {
          "type": "file",
          "value": "charset/GB2312.cst"
        },
        {
          "type": "range",
          "value": "0x4E00-0x9FFF"
        },
        {
          "type": "string",
          "value": "常用汉字"
        }
      ]
    }
  ]
}
```

### 配置参数说明

#### 必需参数

- `fontPath`: TrueType 字体文件路径（.ttf 或 .ttc）
- `outputPath`: 输出目录路径
- `fontSize`: 字体大小（像素）
- `outputFormat`: 输出格式（"bitmap" 或 "vector"）
- `characterSets`: 字符集定义数组

#### Bitmap 专用参数

- `renderMode`: 每像素位数（1, 2, 4, 或 8）
- `bold`: 启用粗体渲染（boolean）
- `italic`: 启用斜体变换（boolean）
- `rotation`: 旋转角度（0, 90, 180, 或 270）
- `gamma`: Gamma 校正值（默认 1.0）
- `crop`: 启用 cropping 以减小文件大小（boolean）

#### 索引参数

- `indexMethod`: 索引方法
  - `0`: Address mode（65536 entries，快速查找）
  - `1`: Offset mode（N entries，节省空间）

**重要**: `crop=true` 只能与 `indexMethod=0` 一起使用

#### 字符集源类型

1. **file**: 从 .cst 文件加载
   ```json
   { "type": "file", "value": "charset/basic.cst" }
   ```

2. **codepage**: 从 CodePage 文件加载
   ```json
   { "type": "codepage", "value": "CodePage/CP936" }
   ```

3. **range**: Unicode 范围
   ```json
   { "type": "range", "value": "0x0020-0x007F" }
   ```

4. **string**: 从字符串提取字符
   ```json
   { "type": "string", "value": "Hello World 你好世界" }
   ```

### INI Settings 覆盖

可以使用 INI 文件覆盖 gamma 和 rotation 设置：

```ini
[Settings]
gamma=1.2
rotation=0
```

将 INI 文件放在与配置文件相同的目录中，命名为 `setting.ini`。

## 输出文件

### Bitmap Fonts

- **字体文件**: `[fontName]_size[size]_bits[mode]_bitmap.bin`
- **字符集文件**: `[fontName]_size[size]_bits[mode]_bitmap.cst`
- **失败字符**: `NotSupportedChars.txt`（如果有渲染失败的字符）

示例: `Arial_size16_bits4_bitmap.bin`

### Vector Fonts

- **字体文件**: `[fontName]_vector.bin`
- **字符集文件**: `[fontName]_vector.cst`

示例: `Arial_vector.bin`

## Binary Format

生成的 binary 文件与 C++ 实现（version 1.0.2）完全兼容。

### Bitmap Font 结构

```
┌─────────────────────────────────────┐
│ Header                              │
│ - version: 1.0.2                    │
│ - fileFlag: 1 (bitmap)              │
│ - renderMode, size, flags           │
├─────────────────────────────────────┤
│ Index Array                         │
│ - Address mode: 65536 × 2/4 bytes   │
│ - Offset mode: N × 4 bytes          │
├─────────────────────────────────────┤
│ Glyph Data                          │
│ - Crop info (if enabled)            │
│ - Packed pixel data                 │
└─────────────────────────────────────┘
```

### Vector Font 结构

```
┌─────────────────────────────────────┐
│ Header                              │
│ - version: 1.0.2                    │
│ - fileFlag: 2 (vector)              │
│ - font metrics                      │
├─────────────────────────────────────┤
│ Index Array                         │
│ - Address mode: 65536 × 4 bytes     │
│ - Offset mode: N × 6 bytes          │
├─────────────────────────────────────┤
│ Glyph Data                          │
│ - Bounding box                      │
│ - Advance width                     │
│ - Contour points                    │
└─────────────────────────────────────┘
```

## 开发

### 构建

```bash
npm run build
```

### 测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# Watch mode
npm run test:watch
```

### 代码质量

```bash
# Linting
npm run lint

# Formatting
npm run format
```

## 测试

项目包含全面的测试套件：

- **Unit Tests**: 验证具体功能和边缘情况
- **Property-Based Tests**: 使用 fast-check 验证通用 properties（100+ 迭代）
- **Integration Tests**: 端到端测试完整流程
- **Compatibility Tests**: 验证与 C++ 实现的兼容性

测试覆盖率目标：80% 以上（lines, branches, functions, statements）

## 故障排除

### 常见问题

**Q: 字体文件找不到**
```
Error: Font file not found: fonts/Arial.ttf
```
A: 检查 `fontPath` 是否正确，支持相对路径和绝对路径。

**Q: 配置验证失败**
```
Error: Invalid parameter combination: crop=true with indexMethod=1
```
A: Crop mode 只能与 Address mode (`indexMethod=0`) 一起使用。

**Q: 字符渲染失败**
```
Warning: Some characters failed to render, see NotSupportedChars.txt
```
A: 某些字符在字体中不存在或无法渲染，检查 `NotSupportedChars.txt` 查看详情。

**Q: 输出目录权限错误**
```
Error: Cannot create output directory
```
A: 确保对输出目录有写权限，工具会自动创建不存在的目录。

### 调试

启用详细日志：

```bash
NODE_ENV=development font-converter config.json
```

## 性能

- **小型字符集** (<1,000 字符): ~2 秒
- **中型字符集** (1,000-10,000 字符): ~5 秒
- **大型字符集** (>10,000 字符): ~10 秒

性能取决于：
- 字符集大小
- 字体复杂度
- Render mode（8-bit 比 1-bit 慢）
- 是否启用 cropping

## 许可证

MIT

## 贡献

欢迎贡献！请提交 Pull Request 或创建 Issue。

## 相关项目

- [C++ Implementation](../font-tool-source/): 原始 Windows 实现
- [Python Implementation](../font-tool-python/): 跨平台 Python 实现

## 支持

如有问题或建议，请创建 GitHub Issue。
