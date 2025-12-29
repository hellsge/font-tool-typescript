/**
 * 打包 font-converter 核心源码为 release 压缩包
 * 
 * Usage: node scripts/pack-release.js
 * Output: dist/font-converter-release.zip
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const RELEASE_DIR = path.join(DIST, 'font-converter');

// 需要打包的核心文件
const CORE_FILES = [
  'src/types/binary.ts',
  'src/types/config.ts',
  'src/types/enums.ts',
  'src/types/index.ts',
  'src/bitmap-generator.ts',
  'src/vector-generator.ts',
  'src/font-generator.ts',
  'src/font-parser.ts',
  'src/charset-processor.ts',
  'src/image-processor.ts',
  'src/binary-writer.ts',
  'src/bitmap-font-header.ts',
  'src/vector-font-header.ts',
  'src/config.ts',
  'src/constants.ts',
  'src/errors.ts',
  'src/path-utils.ts',
  'src/index.ts',
];

// 配置文件
const CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'README.md',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`  ${path.relative(ROOT, src)}`);
}

function createMinimalPackageJson() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  
  // 只保留必要字段
  const minimalPkg = {
    name: pkg.name || 'font-converter',
    version: pkg.version || '1.0.0',
    description: pkg.description || 'Embedded font converter',
    main: 'src/index.ts',
    types: 'src/index.ts',
    dependencies: {
      'opentype.js': pkg.dependencies?.['opentype.js'] || '^1.3.4',
      'sharp': pkg.dependencies?.['sharp'] || '^0.33.0',
    },
    peerDependencies: {
      'typescript': '>=4.5.0'
    }
  };
  
  return JSON.stringify(minimalPkg, null, 2);
}

function main() {
  console.log('Packing font-converter release...\n');
  
  // 清理
  if (fs.existsSync(RELEASE_DIR)) {
    fs.rmSync(RELEASE_DIR, { recursive: true });
  }
  ensureDir(RELEASE_DIR);
  
  // 复制核心源码
  console.log('Core files:');
  for (const file of CORE_FILES) {
    const src = path.join(ROOT, file);
    const dest = path.join(RELEASE_DIR, file);
    if (fs.existsSync(src)) {
      copyFile(src, dest);
    } else {
      console.warn(`  [WARN] Missing: ${file}`);
    }
  }
  
  // 复制 README
  console.log('\nConfig files:');
  copyFile(path.join(ROOT, 'README.md'), path.join(RELEASE_DIR, 'README.md'));
  
  // 生成精简 package.json
  const minimalPkg = createMinimalPackageJson();
  fs.writeFileSync(path.join(RELEASE_DIR, 'package.json'), minimalPkg);
  console.log('  package.json (minimal)');
  
  // 复制 tsconfig (如果需要独立编译)
  if (fs.existsSync(path.join(ROOT, 'tsconfig.json'))) {
    copyFile(path.join(ROOT, 'tsconfig.json'), path.join(RELEASE_DIR, 'tsconfig.json'));
  }
  
  // 创建 zip
  console.log('\nCreating zip...');
  const zipPath = path.join(DIST, 'font-converter-release.zip');
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  // Windows: 使用 PowerShell Compress-Archive
  // Linux/Mac: 使用 zip 命令
  try {
    if (process.platform === 'win32') {
      execSync(`powershell Compress-Archive -Path "${RELEASE_DIR}\\*" -DestinationPath "${zipPath}"`, { stdio: 'inherit' });
    } else {
      execSync(`cd "${DIST}" && zip -r font-converter-release.zip font-converter`, { stdio: 'inherit' });
    }
    console.log(`\n✅ Done: ${path.relative(ROOT, zipPath)}`);
  } catch (e) {
    console.log(`\n⚠️  Zip failed, but files are ready at: ${path.relative(ROOT, RELEASE_DIR)}`);
  }
  
  // 统计
  const fileCount = CORE_FILES.length + 3; // +3 for package.json, tsconfig, README
  console.log(`\nTotal: ${fileCount} files`);
}

main();
