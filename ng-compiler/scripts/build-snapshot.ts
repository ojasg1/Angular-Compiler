/**
 * Pre-installs WebContainer dependencies and generates a snapshot
 * for faster boot times. Run with: npm run build:snapshot
 *
 * This creates public/wc-snapshot.bin which the WebContainerService
 * can load instead of running npm install.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function buildSnapshot() {
  console.log('Building WebContainer snapshot...');

  try {
    const { snapshot } = await import('@webcontainer/snapshot');

    // The dependencies that the candidate app needs
    const packageJson = {
      name: 'candidate-app',
      version: '0.0.0',
      private: true,
      dependencies: {
        '@angular/common': '19.0.0',
        '@angular/compiler': '19.0.0',
        '@angular/core': '19.0.0',
        '@angular/forms': '19.0.0',
        '@angular/platform-browser': '19.0.0',
        '@angular/platform-browser-dynamic': '19.0.0',
        'rxjs': '7.8.1',
        'tslib': '2.8.1',
        'zone.js': '0.15.0',
      },
      devDependencies: {
        'vite': '5.4.11',
      },
    };

    const snapshotData = await snapshot({
      'package.json': {
        file: { contents: JSON.stringify(packageJson, null, 2) },
      },
    });

    const outDir = join(projectRoot, 'public');
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const outPath = join(outDir, 'wc-snapshot.bin');
    writeFileSync(outPath, Buffer.from(snapshotData));
    console.log(`Snapshot written to ${outPath} (${(snapshotData.byteLength / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error('Failed to build snapshot:', err);
    console.log('The app will fall back to npm install at runtime.');
    process.exit(1);
  }
}

buildSnapshot();
