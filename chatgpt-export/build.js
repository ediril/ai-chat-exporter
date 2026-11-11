const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const gitVersion = require('../versioning');

const distDir = path.join(__dirname, 'dist');
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir);
const page = fs.readFileSync(path.join(__dirname, 'index.php'), 'utf8');
fs.writeFileSync(path.join(distDir, 'index.php'), page.replace('{{VERSION}}', gitVersion(__dirname)));

// Obfuscation options - optimized for bookmarklets
const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false, // Keep false for bookmarklets
  deadCodeInjection: false, // Keep false to reduce size
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: false, // Keep false to reduce size
  renameGlobals: false, // Keep false for bookmarklets
  selfDefending: false, // Keep false for bookmarklets
  simplify: true,
  splitStrings: false, // Keep false to reduce size
  stringArray: true,
  stringArrayCallsTransform: false, // Keep false to reduce size
  stringArrayEncoding: [],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false
};

// File to obfuscate
const files = [
  { input: 'markdown_bookmarklet.js', output: 'markdown_bookmarklet.js' }
];

console.log('🔨 Building obfuscated bookmarklets...\n');

files.forEach(({ input, output }) => {
  const inputPath = path.join(__dirname, input);
  const outputPath = path.join(distDir, output);

  try {
    // Read the source file
    const code = fs.readFileSync(inputPath, 'utf8');

    // Find javascript: prefix (may be after comments)
    const jsIndex = code.indexOf('javascript:');
    const hasPrefix = jsIndex !== -1;

    // Extract code to obfuscate (everything after 'javascript:')
    const codeToObfuscate = hasPrefix ? code.substring(jsIndex + 'javascript:'.length) : code;

    // Obfuscate
    const obfuscationResult = JavaScriptObfuscator.obfuscate(codeToObfuscate, obfuscatorOptions);

    // Add prefix back if it was there
    const finalCode = hasPrefix ? 'javascript:' + obfuscationResult.getObfuscatedCode() : obfuscationResult.getObfuscatedCode();

    // Write to dist
    fs.writeFileSync(outputPath, finalCode);

    const originalSize = Buffer.byteLength(code, 'utf8');
    const obfuscatedSize = Buffer.byteLength(finalCode, 'utf8');
    const sizeChange = ((obfuscatedSize - originalSize) / originalSize * 100).toFixed(1);

    console.log(`✓ ${input}`);
    console.log(`  Original:    ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  Obfuscated:  ${(obfuscatedSize / 1024).toFixed(2)} KB (${sizeChange > 0 ? '+' : ''}${sizeChange}%)`);
    console.log(`  Output:      dist/${output}\n`);
  } catch (error) {
    console.error(`✗ Failed to obfuscate ${input}:`, error.message);
  }
});

console.log('✅ Build complete!');
