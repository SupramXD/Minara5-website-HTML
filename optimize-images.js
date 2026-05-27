const fs = require('fs');
const path = require('path');

// Ensure directories exist
const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');

if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Verify dependencies are installed
let sharp, chokidar;
try {
    sharp = require('sharp');
    chokidar = require('chokidar');
} catch (e) {
    console.error(`\x1b[31m[ERROR] Required dependencies are missing!\x1b[0m`);
    console.error(`Please install them by running the following command in your terminal:`);
    console.error(`\n    \x1b[36mnpm init -y && npm install sharp chokidar\x1b[0m\n`);
    process.exit(1);
}

console.log(`\x1b[32m[STARTING] Minara5 Local Image Automation Pipeline\x1b[0m`);
console.log(`Monitoring directory: ${inputDir}`);
console.log(`Output directory:     ${outputDir}`);
console.log(`Watching for new product images...\n`);

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

// Watch input directory for new or updated files
const watcher = chokidar.watch(inputDir, {
    ignored: /(^|[\/\\])\../, // Ignore hidden files
    persistent: true,
    awaitWriteFinish: {
        stabilityThreshold: 2000, // wait 2 seconds after last write before processing
        pollInterval: 100
    }
});

watcher.on('add', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
        return;
    }

    const filename = path.basename(filePath);
    const basename = path.basename(filePath, ext);
    
    // Ignore output files or temp files
    if (filename.endsWith('-main.avif') || filename.endsWith('-thumb.avif')) {
        return;
    }

    console.log(`\x1b[36m[NEW FILE] Detected: ${filename}\x1b[0m`);
    
    const mainOutputName = `${basename}-main.avif`;
    const thumbOutputName = `${basename}-thumb.avif`;
    
    const mainOutputPath = path.join(outputDir, mainOutputName);
    const thumbOutputPath = path.join(outputDir, thumbOutputName);

    try {
        const stats = fs.statSync(filePath);
        const originalSizeKB = (stats.size / 1024).toFixed(1);

        console.log(`Processing ${filename} (${originalSizeKB} KB)...`);

        // Read source image
        const image = sharp(filePath);

        // Retrieve metadata to ensure it's valid
        const metadata = await image.metadata();

        // Pipeline 1: Generate Main Product View (1200px width, 80% quality AVIF)
        await sharp(filePath)
            .flatten({ background: '#ffffff' }) // Flatten transparency against white background
            .resize(1200, null, { withoutEnlargement: true }) // Width 1200px (auto-height)
            .avif({ quality: 80, effort: 6 }) // AVIF format, 80 quality, CPU effort 6
            .toFile(mainOutputPath);

        // Pipeline 2: Generate Thumbnail View (600px width, 50% quality AVIF)
        await sharp(filePath)
            .flatten({ background: '#ffffff' })
            .resize(600, null, { withoutEnlargement: true }) // Width 600px (auto-height)
            .avif({ quality: 50, effort: 6 }) // AVIF format, 50 quality, CPU effort 6
            .toFile(thumbOutputPath);

        // Get output sizes
        const mainStats = fs.statSync(mainOutputPath);
        const thumbStats = fs.statSync(thumbOutputPath);
        
        const mainSizeKB = (mainStats.size / 1024).toFixed(1);
        const thumbSizeKB = (thumbStats.size / 1024).toFixed(1);
        
        const mainSaving = ((1 - (mainStats.size / stats.size)) * 100).toFixed(0);
        const thumbSaving = ((1 - (thumbStats.size / stats.size)) * 100).toFixed(0);

        console.log(`\x1b[32m[SUCCESS] Finished processing: ${filename}\x1b[0m`);
        console.log(`  └─ Original:  ${originalSizeKB} KB`);
        console.log(`  └─ Main View: ${mainSizeKB} KB (\x1b[32m-${mainSaving}%\x1b[0m saved as \x1b[33moutput/${mainOutputName}\x1b[0m)`);
        console.log(`  └─ Thumbnail: ${thumbSizeKB} KB (\x1b[32m-${thumbSaving}%\x1b[0m saved as \x1b[33moutput/${thumbOutputName}\x1b[0m)`);
        console.log(``);
    } catch (err) {
        console.error(`\x1b[31m[ERROR] Failed to process ${filename}:\x1b[0m`, err.message);
    }
});

watcher.on('error', error => console.error(`Watcher error: ${error}`));
