# 配置示例

本目录包含各种使用场景的示例配置文件。

## 基本示例

### bitmap_basic.json
最简单的 bitmap font 配置：
- 16px 字体大小
- 4-bit render mode
- ASCII 字符范围（0x0020-0x007F）
- Address mode 索引

```bash
font-converter examples/bitmap_basic.json
```

### vector_basic.json
基本的 vector font 配置：
- 16px 字体大小
- ASCII 字符范围
- Address mode 索引

```bash
font-converter examples/vector_basic.json
```

## 样式示例

### bitmap_bold_italic.json
带样式的 bitmap font：
- 粗体 + 斜体
- 8-bit render mode（高质量）
- Gamma 校正 1.2
- 混合字符源（range + string）

```bash
font-converter examples/bitmap_bold_italic.json
```

## 优化示例

### bitmap_crop.json
启用 cropping 以减小文件大小：
- Crop mode 启用
- 自动移除空白空间
- 适合字符大小差异大的字体

```bash
font-converter examples/bitmap_crop.json
```

**注意**: Crop mode 只能与 `indexMethod=0` (Address mode) 一起使用。

## 多语言示例

### chinese_characters.json
中文字符支持：
- 使用 NotoSansSC 字体
- 从 .cst 文件加载字符集
- Offset mode 索引（节省空间）
- 8-bit render mode

```bash
font-converter examples/chinese_characters.json
```

## 高级示例

### advanced_multi_config.json
单个配置文件中的多个字体：
- 拉丁字符（NotoSans）
- 中文字符（NotoSansSC）
- 日文字符（NotoSansJP）
- 混合 bitmap 和 vector 格式
- 不同的输出目录

```bash
font-converter examples/advanced_multi_config.json
```

## CLI 参数覆盖

所有示例都可以通过 CLI 参数覆盖：

```bash
# 覆盖字体大小
font-converter examples/bitmap_basic.json --size 24

# 启用粗体
font-converter examples/bitmap_basic.json --bold

# 更改输出目录
font-converter examples/bitmap_basic.json --output ./my-output

# 组合多个覆盖
font-converter examples/bitmap_basic.json --size 20 --bold --italic --render-mode 8
```

## INI Settings 覆盖

创建 `setting.ini` 文件在配置文件旁边：

```ini
[Settings]
gamma=1.2
rotation=90
```

这将覆盖配置文件中的 gamma 和 rotation 值。

## 字符集源类型

### 1. Range（Unicode 范围）
```json
{
  "type": "range",
  "value": "0x0020-0x007F"
}
```

常用范围：
- `0x0020-0x007F`: ASCII 基本字符
- `0x00A0-0x00FF`: Latin-1 补充
- `0x4E00-0x9FFF`: CJK 统一汉字
- `0x3040-0x309F`: 日文平假名
- `0x30A0-0x30FF`: 日文片假名
- `0xAC00-0xD7AF`: 韩文音节

### 2. File（.cst 文件）
```json
{
  "type": "file",
  "value": "../charset/GB2312.cst"
}
```

### 3. CodePage
```json
{
  "type": "codepage",
  "value": "../CodePage/CP936"
}
```

### 4. String（自定义字符）
```json
{
  "type": "string",
  "value": "Hello World! 你好世界"
}
```

## 输出文件

运行配置后，将生成以下文件：

### Bitmap Fonts
- `[fontName]_size[size]_bits[mode]_bitmap.bin` - 字体数据
- `[fontName]_size[size]_bits[mode]_bitmap.cst` - 字符集
- `NotSupportedChars.txt` - 失败的字符（如果有）

### Vector Fonts
- `[fontName]_vector.bin` - 字体数据
- `[fontName]_vector.cst` - 字符集

## 故障排除

### 字体文件路径
示例使用相对路径指向本地 `Font` 目录。如果字体文件找不到，请调整路径：

```json
{
  "fontPath": "/absolute/path/to/font.ttf"
}
```

### 字符集文件路径
同样，字符集文件路径可能需要调整：

```json
{
  "type": "file",
  "value": "/absolute/path/to/charset.cst"
}
```

### 输出目录
确保输出目录存在或工具有权限创建它：

```json
{
  "outputPath": "./output/"
}
```

## 性能提示

- **小字符集** (<1,000 字符): 使用任何配置
- **中型字符集** (1,000-10,000 字符): 考虑使用 Offset mode (`indexMethod=1`)
- **大型字符集** (>10,000 字符): 使用 Offset mode 并考虑 cropping
- **高质量渲染**: 使用 8-bit render mode
- **最小文件大小**: 使用 1-bit render mode + cropping
