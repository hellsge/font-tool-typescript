# TypeScript Font Converter

嵌入式字体转换工具，将 TrueType 字体转换为优化的 binary 格式，与 C++ 实现 (v1.0.2) 字节级兼容。

## 安装

```bash
npm install
npm run build
```

---

## CLI 使用

```bash
font-converter <config.json> [options]
```

### 参数

| 参数 | 说明 |
|------|------|
| `<config>` | JSON 配置文件路径 (必需) |

### 选项

| 选项 | 说明 | 示例 |
|------|------|------|
| `-s, --size <n>` | 覆盖字号 | `--size 24` |
| `-b, --bold` | 启用粗体 | |
| `--no-bold` | 禁用粗体 | |
| `-i, --italic` | 启用斜体 | |
| `--no-italic` | 禁用斜体 | |
| `-m, --render-mode <n>` | 位深度 (1/2/4/8) | `-m 4` |
| `-o, --output <path>` | 输出目录 | `-o ./out` |
| `-r, --rotation <n>` | 旋转 (0/1/2/3) | `-r 1` |
| `-v, --version` | 版本号 | |
| `-h, --help` | 帮助 | |

### 示例

```bash
# 基本使用
font-converter config.json

# 覆盖参数
font-converter config.json --size 24 --bold -m 4 -o ./output

# 查看帮助
font-converter --help
```

---

## 配置文件

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
    "bold": false,
    "italic": false,
    "rotation": 0,
    "gamma": 1.0,
    "rvd": false,
    "characterSets": [
      { "type": "range", "value": "0x0020-0x007F" }
    ]
  }]
}
```

### 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `fontPath` | string | ✓ | 字体文件 (.ttf/.ttc) |
| `outputPath` | string | ✓ | 输出目录 |
| `fontSize` | number | ✓ | 字号 (px) |
| `outputFormat` | string | ✓ | `"bitmap"` / `"vector"` |
| `renderMode` | number | ✓ | 位深度: 1, 2, 4, 8 (bitmap only) |
| `indexMethod` | number | ✓ | 0=Address, 1=Offset |
| `crop` | boolean | | 裁剪空白 (仅 indexMethod=0) |
| `bold` | boolean | | 粗体 |
| `italic` | boolean | | 斜体 |
| `rotation` | number | | 0=0°, 1=90°, 2=270°, 3=180° |
| `gamma` | number | | Gamma 校正，默认 1.0 |
| `rvd` | boolean | | Render Vector Data 模式 |
| `characterSets` | array | ✓ | 字符集定义 |

### 字符集类型

```json
// Unicode 范围
{ "type": "range", "value": "0x0020-0x007F" }

// 字符集文件 (.cst)
{ "type": "file", "value": "charset/basic.cst" }

// CodePage 目录
{ "type": "codepage", "value": "CodePage/CP936" }

// 直接字符串
{ "type": "string", "value": "Hello 你好" }
```

### indexMethod 说明

| 值 | 模式 | Index 大小 | 适用场景 |
|----|------|-----------|----------|
| 0 | Address | 128KB (固定) | 快速查找，Unicode 直接寻址 |
| 1 | Offset | 2B × 字符数 | 节省空间，顺序存储 |

### rvd 模式说明

| rvd | 行为 | 公式 |
|-----|------|------|
| false (默认) | 缩小字号适应 backSize | `scaledFontSize = fontSize × unitsPerEM / (asc - desc)` |
| true | 原始字号渲染 | `backSize = fontSize × (asc - desc) / unitsPerEM` |

---

## 输出文件

| 格式 | 文件名模式 |
|------|-----------|
| Bitmap | `[fontName]_size[N]_bits[M]_bitmap.bin` |
| Vector | `[fontName]_vector.bin` |
| 字符集 | `[fontName].cst` |
| 失败字符 | `NotSupportedChars.txt` |

---

## API 使用

```typescript
import { BitmapFontGenerator, RenderMode } from './src';

const generator = new BitmapFontGenerator({
  fontPath: 'fonts/Arial.ttf',
  outputPath: 'output/',
  fontSize: 16,
  renderMode: RenderMode.BIT_4,
  outputFormat: 'bitmap',
  indexMethod: 0,
  crop: false,
  bold: false,
  italic: false,
  rotation: 0,
  gamma: 1.0,
  characterSets: [{ type: 'range', value: '0x0020-0x007F' }]
});

await generator.generate();
```

---

## 开发

```bash
npm run build      # 构建
npm test           # 单元测试
npm run lint       # 代码检查
```

### 兼容性测试 (TS vs C++)

```bash
npx ts-node tests/compatibility/run-all.ts
```

> 需要 `../font-tool-release/fontDictionary.exe`，快速模式加 `--quick`

---

## 相关项目

- [C++ Implementation](../font-tool-source/)
- [Python Implementation](../font-tool-python/)
