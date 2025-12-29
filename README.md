# TypeScript Font Converter

嵌入式字体转换工具，将 TrueType 字体转换为优化的 binary 格式，与 C++ 实现 (v1.0.2) 字节级兼容。

## 特性

- Bitmap (1/2/4/8-bit) 和 Vector 字体
- 多种字符编码：CodePage、Unicode range、自定义字符集
- 文本效果：粗体、斜体、旋转、gamma 校正
- 索引方式：Address mode (快速查找) / Offset mode (节省空间)
- 跨平台：Windows、macOS、Linux

## 安装

```bash
npm install
npm run build
```

## 快速开始

```bash
font-converter config.json
font-converter config.json --size 24 --bold --output ./output
```

## 配置示例

```json
{
  "fonts": [{
    "fontPath": "fonts/Arial.ttf",
    "outputPath": "output/",
    "fontSize": 16,
    "renderMode": 4,
    "outputFormat": "bitmap",
    "indexMethod": 0,
    "crop": false,
    "characterSets": [
      { "type": "range", "value": "0x0020-0x007F" }
    ]
  }]
}
```

## 配置参数

| 参数 | 说明 | 值 |
|------|------|-----|
| `fontPath` | 字体文件路径 | .ttf / .ttc |
| `outputPath` | 输出目录 | |
| `fontSize` | 字体大小 (px) | |
| `outputFormat` | 输出格式 | `bitmap` / `vector` |
| `renderMode` | 位深度 (bitmap) | 1, 2, 4, 8 |
| `indexMethod` | 索引方式 | 0=Address, 1=Offset |
| `crop` | 裁剪空白 | boolean (仅 indexMethod=0) |
| `bold` / `italic` | 粗体/斜体 | boolean |
| `rotation` | 旋转角度 | 0, 90, 180, 270 |
| `gamma` | Gamma 校正 | 默认 1.0 |

### 字符集类型

```json
{ "type": "file", "value": "charset/basic.cst" }
{ "type": "codepage", "value": "CodePage/CP936" }
{ "type": "range", "value": "0x0020-0x007F" }
{ "type": "string", "value": "Hello 你好" }
```

## API 使用

```typescript
import { BitmapFontGenerator, RenderMode } from './src';

const generator = new BitmapFontGenerator({
  fontPath: 'fonts/Arial.ttf',
  outputPath: 'output/',
  fontSize: 16,
  renderMode: RenderMode.BIT_4,
  outputFormat: 'bitmap',
  characterSets: [{ type: 'range', value: '0x0020-0x007F' }]
});

await generator.generate();
```

## 输出文件

- Bitmap: `[fontName]_size[size]_bits[mode]_bitmap.bin`
- Vector: `[fontName]_vector.bin`
- 字符集: `.cst` 文件
- 失败字符: `NotSupportedChars.txt`

## 开发

```bash
npm run build      # 构建
npm test           # 测试
npm run lint       # 代码检查
```

## 相关项目

- [C++ Implementation](../font-tool-source/)
- [Python Implementation](../font-tool-python/)

## License

MIT
