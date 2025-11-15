#!/usr/bin/env node
/**
 * Build script for the browser extension
 * Bundles ES modules and dependencies for Chrome extension compatibility
 */

import * as esbuild from 'esbuild';
import { readdir, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatch = process.argv.includes('--watch');
const distDir = join(__dirname, 'dist');

// Ensure dist directory exists
if (!existsSync(distDir)) {
    await mkdir(distDir, { recursive: true });
}

// Copy static files
async function copyStaticFiles() {
    const { readFile, writeFile } = await import('fs/promises');

    // Copy manifest and update paths
    const manifestPath = join(__dirname, 'manifest.json');
    let manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Update paths to be relative to dist directory
    manifest.background.service_worker = 'background/service-worker.js';
    manifest.action.default_popup = 'popup.html';
    manifest.options_page = 'options.html';
    manifest.action.default_icon = {
        '16': 'icons/icon16.png',
        '32': 'icons/icon32.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png'
    };
    manifest.icons = {
        '16': 'icons/icon16.png',
        '32': 'icons/icon32.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png'
    };

    await writeFile(join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('Copied and updated manifest.json');

    const filesToCopy = [
        { from: 'src/popup/popup.html', to: 'popup.html' },
        { from: 'src/popup/popup.css', to: 'popup.css' },
        { from: 'src/options/options.html', to: 'options.html' },
        { from: 'src/options/options.css', to: 'options.css' },
    ];

    // Ensure background directory exists
    const backgroundDir = join(distDir, 'background');
    if (!existsSync(backgroundDir)) {
        await mkdir(backgroundDir, { recursive: true });
    }

    for (const file of filesToCopy) {
        const src = join(__dirname, file.from);
        const dest = join(distDir, file.to);
        const destDir = dirname(dest);

        if (!existsSync(destDir)) {
            await mkdir(destDir, { recursive: true });
        }

        await copyFile(src, dest);
        console.log(`Copied ${file.from} -> ${file.to}`);
    }

    // Copy icons if they exist
    const iconsDir = join(__dirname, 'icons');
    const distIconsDir = join(distDir, 'icons');
    if (existsSync(iconsDir)) {
        if (!existsSync(distIconsDir)) {
            await mkdir(distIconsDir, { recursive: true });
        }

        try {
            const iconFiles = await readdir(iconsDir);
            for (const icon of iconFiles) {
                if (icon.endsWith('.png')) {
                    await copyFile(join(iconsDir, icon), join(distIconsDir, icon));
                    console.log(`Copied icon: ${icon}`);
                }
            }
        } catch (err) {
            console.warn('Could not copy icons:', err.message);
        }
    }
}

// Build configuration
const esbuildConfig = {
    bundle: true,
    minify: false,
    sourcemap: false,
    format: 'esm',
    target: 'es2020',
    platform: 'browser',
    logLevel: 'info',
};

// Build service worker
async function buildServiceWorker() {
    await esbuild.build({
        ...esbuildConfig,
        entryPoints: ['src/background/service-worker.js'],
        outfile: 'dist/background/service-worker.js',
        banner: {
            js: '// Service Worker - Built with esbuild\n',
        },
        external: ['chrome'], // Chrome APIs are available globally
    });
    console.log('✓ Built service worker');
}

// Build popup script
async function buildPopup() {
    await esbuild.build({
        ...esbuildConfig,
        entryPoints: ['src/popup/popup.js'],
        outfile: 'dist/popup.js',
        banner: {
            js: '// Popup Script - Built with esbuild\n',
        },
        external: ['chrome'],
    });
    console.log('✓ Built popup script');
}

// Build options script
async function buildOptionsScript() {
    await esbuild.build({
        ...esbuildConfig,
        entryPoints: ['src/options/options.js'],
        outfile: 'dist/options.js',
        banner: {
            js: '// Options Script - Built with esbuild\n',
        },
        external: ['chrome'],
    });
    console.log('✓ Built options script');
}

// Update HTML files to point to bundled JS (no changes needed, paths are already correct)
async function updateHTMLFiles() {
    // HTML files already have correct paths, just ensure they're copied
    console.log('✓ HTML files ready');
}

// Main build function
async function build() {
    console.log('Building extension...\n');

    try {
        await copyStaticFiles();
        await buildServiceWorker();
        await buildPopup();
        await buildOptionsScript();
        await updateHTMLFiles();

        console.log('\n✓ Build complete!');
        console.log('Load the extension from the dist/ directory');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

// Watch mode
if (isWatch) {
    console.log('Starting watch mode...\n');

    const ctx = await esbuild.context({
        ...esbuildConfig,
        entryPoints: [
            'src/background/service-worker.js',
            'src/popup/popup.js',
            'src/options/options.js',
        ],
        outdir: 'dist',
        outbase: 'src',
    });

    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await build();
}

