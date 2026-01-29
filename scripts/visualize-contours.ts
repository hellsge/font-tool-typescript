/**
 * 可视化对比脚本
 * 
 * 对比原始字体（有重叠）和 no_overlap 字体的轮廓渲染结果
 */

import * as fs from 'fs';
import * as path from 'path';
import { FontParser } from '../src/font-parser';
import * as polygonClipping from 'polygon-clipping';
import { Polygon, MultiPolygon, Ring } from 'polygon-clipping';

// 简单的 PPM 图像输出（无需额外依赖）
function writePPM(filename: string, width: number, height: number, pixels: Uint8Array): void {
  const header = `P6\n${width} ${height}\n255\n`;
  const buffer = Buffer.concat([Buffer.from(header), Buffer.from(pixels)]);
  fs.writeFileSync(filename, buffer);
}

// 扫描线填充算法（模拟 font_ttf.c 的渲染）
function scanlineFill(
  contours: Array<Array<{x: number, y: number}>>,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number
): Uint8Array {
  const pixels = new Uint8Array(width * height * 3).fill(0); // RGB black background
  
  // 构建边表
  interface Edge {
    yMin: number;
    yMax: number;
    x: number;
    dx: number;
  }
  
  const edges: Edge[] = [];
  
  for (const contour of contours) {
    for (let i = 0; i < contour.length; i++) {
      const p1 = contour[i];
      const p2 = contour[(i + 1) % contour.length];
      
      // 转换坐标（Y轴翻转 + 偏移）
      const x1 = p1.x - offsetX;
      const y1 = -p1.y - offsetY;  // Y轴翻转
      const x2 = p2.x - offsetX;
      const y2 = -p2.y - offsetY;
      
      if (y1 === y2) continue; // 跳过水平边
      
      const yMin = Math.min(y1, y2);
      const yMax = Math.max(y1, y2);
      const xAtYMin = y1 < y2 ? x1 : x2;
      const dx = (x2 - x1) / (y2 - y1);
      
      edges.push({ yMin, yMax, x: xAtYMin, dx });
    }
  }
  
  // 扫描线填充
  for (let y = 0; y < height; y++) {
    // 找到与当前扫描线相交的边
    const intersections: number[] = [];
    
    for (const edge of edges) {
      if (y >= edge.yMin && y < edge.yMax) {
        const x = edge.x + edge.dx * (y - edge.yMin);
        intersections.push(x);
      }
    }
    
    // 排序交点
    intersections.sort((a, b) => a - b);
    
    // 奇偶填充
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.max(0, Math.floor(intersections[i]));
      const xEnd = Math.min(width - 1, Math.ceil(intersections[i + 1]));
      
      for (let x = xStart; x <= xEnd; x++) {
        const idx = (y * width + x) * 3;
        pixels[idx] = 255;     // R
        pixels[idx + 1] = 255; // G
        pixels[idx + 2] = 255; // B
      }
    }
  }
  
  return pixels;
}

// 展平曲线
function flattenContour(contour: Array<{x: number, y: number, onCurve: boolean}>): Array<{x: number, y: number}> {
  if (contour.length < 2) {
    return contour.map(p => ({ x: p.x, y: p.y }));
  }
  
  const result: Array<{x: number, y: number}> = [];
  let i = 0;
  
  while (i < contour.length) {
    const current = contour[i];
    
    if (current.onCurve) {
      result.push({ x: current.x, y: current.y });
      i++;
    } else {
      const start = result.length > 0 
        ? result[result.length - 1] 
        : { x: contour[contour.length - 1].x, y: contour[contour.length - 1].y };
      
      const controlPoints: Array<{x: number, y: number}> = [];
      while (i < contour.length && !contour[i].onCurve) {
        controlPoints.push({ x: contour[i].x, y: contour[i].y });
        i++;
      }
      
      const end = i < contour.length 
        ? { x: contour[i].x, y: contour[i].y }
        : { x: contour[0].x, y: contour[0].y };
      
      // 展平二次贝塞尔
      if (controlPoints.length === 1) {
        flattenQuadratic(start, controlPoints[0], end, result);
      } else {
        // 多个控制点，分割成多个二次曲线
        let currentStart = start;
        for (let j = 0; j < controlPoints.length - 1; j++) {
          const cp = controlPoints[j];
          const nextCp = controlPoints[j + 1];
          const impliedEnd = {
            x: Math.round((cp.x + nextCp.x) / 2),
            y: Math.round((cp.y + nextCp.y) / 2)
          };
          flattenQuadratic(currentStart, cp, impliedEnd, result);
          currentStart = impliedEnd;
        }
        flattenQuadratic(currentStart, controlPoints[controlPoints.length - 1], end, result);
      }
      
      if (i < contour.length && contour[i].onCurve) {
        result.push(end);
        i++;
      }
    }
  }
  
  // 去重
  const deduped: Array<{x: number, y: number}> = [];
  for (const p of result) {
    if (deduped.length === 0 || p.x !== deduped[deduped.length - 1].x || p.y !== deduped[deduped.length - 1].y) {
      deduped.push(p);
    }
  }
  return deduped;
}

function flattenQuadratic(
  p0: {x: number, y: number},
  p1: {x: number, y: number},
  p2: {x: number, y: number},
  result: Array<{x: number, y: number}>,
  tolerance: number = 1.0
): void {
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const d = Math.abs((p1.x - p0.x) * dy - (p1.y - p0.y) * dx) / Math.sqrt(dx * dx + dy * dy + 0.0001);
  
  if (d <= tolerance) {
    return;
  }
  
  const mid01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const mid12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const mid = { x: (mid01.x + mid12.x) / 2, y: (mid01.y + mid12.y) / 2 };
  
  flattenQuadratic(p0, mid01, mid, result, tolerance);
  result.push({ x: Math.round(mid.x), y: Math.round(mid.y) });
  flattenQuadratic(mid, mid12, p2, result, tolerance);
}

// 去重叠 - 对同方向的轮廓做 union，保留不同方向的轮廓（孔洞）
function removeOverlaps(contours: Array<Array<{x: number, y: number}>>): Array<Array<{x: number, y: number}>> {
  const valid = contours.filter(c => c.length >= 3);
  if (valid.length <= 1) return valid;
  
  // 按方向分组
  const contoursWithArea = valid.map(contour => ({
    contour,
    area: signedArea(contour)
  }));
  
  // CW (area < 0) 是外轮廓，CCW (area > 0) 是孔洞
  const cwContours = contoursWithArea.filter(c => c.area < 0).map(c => c.contour);
  const ccwContours = contoursWithArea.filter(c => c.area >= 0).map(c => c.contour);
  
  // 只对 CW 轮廓（外轮廓）做 union
  let processedCW = cwContours;
  
  if (cwContours.length > 1) {
    try {
      // 转换为 CCW 给 polygon-clipping（它期望 CCW 外轮廓）
      const polygons: Polygon[] = cwContours.map(contour => {
        const reversed = [...contour].reverse();
        const ring: Ring = reversed.map(p => [p.x, p.y] as [number, number]);
        if (ring.length > 0) {
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            ring.push([first[0], first[1]]);
          }
        }
        return [ring];
      });
      
      const [first, ...rest] = polygons;
      const result: MultiPolygon = rest.length > 0 
        ? polygonClipping.union(first, ...rest)
        : [first];
      
      processedCW = [];
      for (const polygon of result) {
        // 只取外轮廓（第一个环），忽略 union 产生的孔洞
        const ring = polygon[0];
        let points = ring.slice(0, -1).map(([x, y]) => ({
          x: Math.round(x),
          y: Math.round(y)
        }));
        // 转回 CW
        points = points.reverse();
        if (points.length >= 3) {
          processedCW.push(points);
        }
      }
    } catch (e) {
      console.warn('removeOverlaps failed:', e);
    }
  }
  
  // 合并处理后的外轮廓和原始孔洞
  return [...processedCW, ...ccwContours];
}
// 计算有符号面积（shoelace formula）
// 正面积 = 逆时针, 负面积 = 顺时针
function signedArea(points: Array<{x: number, y: number}>): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

async function main() {
  const testChars = ['f', 'H', 'e', 'y', 'G', 'U', 'I', 'o', 'n'];
  const fontSize = 100;
  const imageWidth = 120;
  const imageHeight = 120;
  
  const originalFontPath = '../../font-tool-release/Font/NotoSansSC_Regular.ttf';
  const noOverlapFontPath = '../../font-tool-release/Font/no_overlap/NotoSansSC_Regular.ttf';
  
  const outputDir = './output/contour_compare';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 加载字体
  const originalParser = new FontParser();
  const noOverlapParser = new FontParser();
  
  await originalParser.load(path.resolve(__dirname, originalFontPath));
  await noOverlapParser.load(path.resolve(__dirname, noOverlapFontPath));
  
  console.log('Generating comparison images...\n');
  
  for (const char of testChars) {
    const unicode = char.charCodeAt(0);
    
    // 获取原始字体轮廓
    const originalOutline = originalParser.getGlyphOutline(unicode, fontSize);
    const noOverlapOutline = noOverlapParser.getGlyphOutline(unicode, fontSize);
    
    if (!originalOutline || !noOverlapOutline) {
      console.log(`Skipping '${char}' - glyph not found`);
      continue;
    }
    
    // 展平曲线
    const originalFlattened = originalOutline.contours.map(c => flattenContour(c));
    const noOverlapFlattened = noOverlapOutline.contours.map(c => flattenContour(c));
    
    // 对原始字体应用去重叠
    const originalProcessed = removeOverlaps(originalFlattened);
    
    // 计算偏移（居中显示）
    const offsetX = originalOutline.boundingBox.x1 - 10;
    const offsetY = -originalOutline.boundingBox.y2 - 10;
    
    // 渲染三个版本
    // 1. 原始（不去重叠）
    const pixelsOriginal = scanlineFill(originalFlattened, imageWidth, imageHeight, offsetX, offsetY);
    writePPM(`${outputDir}/${char}_1_original.ppm`, imageWidth, imageHeight, pixelsOriginal);
    
    // 2. 原始 + 去重叠
    const pixelsProcessed = scanlineFill(originalProcessed, imageWidth, imageHeight, offsetX, offsetY);
    writePPM(`${outputDir}/${char}_2_processed.ppm`, imageWidth, imageHeight, pixelsProcessed);
    
    // 3. no_overlap 字体（参考）
    const pixelsReference = scanlineFill(noOverlapFlattened, imageWidth, imageHeight, offsetX, offsetY);
    writePPM(`${outputDir}/${char}_3_reference.ppm`, imageWidth, imageHeight, pixelsReference);
    
    console.log(`'${char}' (U+${unicode.toString(16).toUpperCase().padStart(4, '0')}): ${originalOutline.contours.length} contours → ${originalProcessed.length} after removeOverlaps`);
  }
  
  console.log(`\nImages saved to ${outputDir}/`);
  console.log('Files: *_1_original.ppm (raw), *_2_processed.ppm (with removeOverlaps), *_3_reference.ppm (no_overlap font)');
}

main().catch(console.error);
