/**
 * 打包 font-converter 源码 + 运行时资源，用于拷贝到其他仓库作为 submodule 替代
 *
 * 目标仓库通过源码直接 import（非编译产物），因此打包内容为：
 *   src/          全部 TypeScript 源码
 *   charset/      .cst 字符集文件（运行时资源）
 *   CodePage/     代码页映射文件（运行时资源）
 *   package.json  依赖声明（opentype.js, commander, ini）
 *   tsconfig.json 编译配置
 *
 * Usage:
 *   node scripts/pack-deploy.js [--output <dir>] [--zip]
 *
 * Options:
 *   --output <dir>  输出目录 (默认: dist/font-converter-deploy)
 *   --zip           生成 zip 压缩包
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ── 参数解析 ──────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    output: path.join(ROOT, 'dist', 'font-converter-deploy'),
    zip: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output') opts.output = path.resolve(args[++i]);
    if (args[i] === '--zip') opts.zip = true;
  }
  return opts;
}

// ── 工具函数 ──────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFileSync(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * 递归复制目录
 * @param {string} src
 * @param {string} dest
 * @param {(name: string) => boolean} [filter] - 文件/目录名过滤
 */
function copyDirSync(src, dest, filter) {
  if (!fs.existsSync(src)) return 0;
  ensureDir(dest);
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (filter && !filter(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirSync(s, d, filter);
    } else {
      copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

function getVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).version || '0.0.0';
  } catch { return '0.0.0'; }
}

/**
 * 生成精简 package.json（只保留运行时依赖）
 */
function createMinimalPackageJson() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  return JSON.stringify({
    name: pkg.name || '@font-tools/converter-ts',
    version: pkg.version || '2.0.0',
    description: pkg.description,
    main: 'src/index.ts',
    dependencies: {
      'opentype.js': pkg.dependencies?.['opentype.js'] || '^1.3.4',
      commander: pkg.dependencies?.commander || '^11.0.0',
      ini: pkg.dependencies?.ini || '^4.1.0',
    },
  }, null, 2);
}

// ── 主流程 ────────────────────────────────────────────────

function main() {
  const opts = parseArgs();
  const DEPLOY = opts.output;

  console.log('=== Font Converter Deploy Pack (Source Mode) ===\n');

  // 清理
  if (fs.existsSync(DEPLOY)) fs.rmSync(DEPLOY, { recursive: true });
  ensureDir(DEPLOY);

  // 1. src/ — 全部 TypeScript 源码
  console.log('[1/4] Copying src/...');
  const srcCount = copyDirSync(
    path.join(ROOT, 'src'),
    path.join(DEPLOY, 'src')
  );
  console.log(`  ${srcCount} files\n`);

  // 2. 运行时资源
  console.log('[2/4] Copying runtime resources...');

  const cpCount = copyDirSync(
    path.join(ROOT, 'CodePage'),
    path.join(DEPLOY, 'CodePage')
  );
  console.log(`  CodePage/: ${cpCount} files`);

  const csCount = copyDirSync(
    path.join(ROOT, 'charset'),
    path.join(DEPLOY, 'charset'),
    (name) => name.endsWith('.cst') // 只要 .cst，跳过 charset.exe
  );
  console.log(`  charset/: ${csCount} files\n`);

  // 3. 配置文件
  console.log('[3/4] Copying config files...');

  fs.writeFileSync(path.join(DEPLOY, 'package.json'), createMinimalPackageJson());
  console.log('  package.json (minimal)');

  copyFileSync(path.join(ROOT, 'tsconfig.json'), path.join(DEPLOY, 'tsconfig.json'));
  console.log('  tsconfig.json\n');

  // 4. 可选 zip
  if (opts.zip) {
    console.log('[4/4] Creating zip...');
    const zipName = `font-converter-deploy-v${getVersion()}.zip`;
    const zipPath = path.join(path.dirname(DEPLOY), zipName);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    try {
      if (process.platform === 'win32') {
        execSync(
          `powershell Compress-Archive -Path "${DEPLOY}\\*" -DestinationPath "${zipPath}"`,
          { stdio: 'inherit' }
        );
      } else {
        const parent = path.dirname(DEPLOY);
        const dirName = path.basename(DEPLOY);
        execSync(`cd "${parent}" && zip -r "${zipName}" "${dirName}"`, { stdio: 'inherit' });
      }
      console.log(`  ${path.relative(ROOT, zipPath)}\n`);
    } catch {
      console.log('  zip failed, files still available in deploy directory\n');
    }
  } else {
    console.log('[4/4] Skipping zip (use --zip to enable)\n');
  }

  // 汇总
  const total = srcCount + cpCount + csCount + 2; // +2 for package.json, tsconfig.json
  console.log('=== Done ===');
  console.log(`Total: ${total} files`);
  console.log(`Output: ${path.relative(ROOT, DEPLOY)}`);
  console.log('\n目标仓库使用方式:');
  console.log('  1. 将输出目录拷贝到目标仓库（如 tools/font-converter/）');
  console.log('  2. 确保根项目 package.json 包含 opentype.js, commander, ini 依赖');
  console.log('  3. 源码中 import { ... } from "tools/font-converter/src/..." 即可');
}

main();
