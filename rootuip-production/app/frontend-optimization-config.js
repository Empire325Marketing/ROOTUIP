const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const terser = require('terser');
const CleanCSS = require('clean-css');
const htmlMinifier = require('html-minifier-terser');

// Frontend Optimization Service
class FrontendOptimizer {
    constructor() {
        this.config = {
            images: {
                formats: ['webp', 'avif'],
                sizes: [320, 640, 768, 1024, 1366, 1920],
                quality: {
                    webp: 85,
                    avif: 80,
                    jpeg: 85
                }
            },
            css: {
                minify: true,
                removeUnused: true,
                inlineCritical: true
            },
            js: {
                minify: true,
                mangle: true,
                compress: true,
                splitChunks: true
            },
            html: {
                minify: true,
                removeComments: true,
                collapseWhitespace: true
            },
            cdn: {
                baseUrl: 'https://cdn.rootuip.com',
                imageUrl: 'https://images.rootuip.com',
                staticUrl: 'https://static.rootuip.com'
            }
        };
    }

    // Optimize images for web
    async optimizeImage(inputPath, outputDir) {
        const filename = path.basename(inputPath, path.extname(inputPath));
        const results = [];

        try {
            // Generate WebP versions
            for (const width of this.config.images.sizes) {
                const webpPath = path.join(outputDir, `${filename}-${width}w.webp`);
                await sharp(inputPath)
                    .resize(width, null, { withoutEnlargement: true })
                    .webp({ quality: this.config.images.quality.webp })
                    .toFile(webpPath);
                results.push({ format: 'webp', width, path: webpPath });
            }

            // Generate AVIF versions (newer, better compression)
            for (const width of this.config.images.sizes) {
                const avifPath = path.join(outputDir, `${filename}-${width}w.avif`);
                await sharp(inputPath)
                    .resize(width, null, { withoutEnlargement: true })
                    .avif({ quality: this.config.images.quality.avif })
                    .toFile(avifPath);
                results.push({ format: 'avif', width, path: avifPath });
            }

            // Keep optimized JPEG fallback
            const jpegPath = path.join(outputDir, `${filename}-optimized.jpg`);
            await sharp(inputPath)
                .jpeg({ quality: this.config.images.quality.jpeg, progressive: true })
                .toFile(jpegPath);
            results.push({ format: 'jpeg', path: jpegPath });

            return results;
        } catch (error) {
            console.error('Image optimization error:', error);
            throw error;
        }
    }

    // Generate responsive image HTML
    generateResponsiveImageHTML(imageName, alt = '') {
        const baseUrl = this.config.cdn.imageUrl;
        const sizes = this.config.images.sizes;
        
        return `
<picture>
    <source 
        type="image/avif"
        srcset="${sizes.map(w => `${baseUrl}/${imageName}-${w}w.avif ${w}w`).join(', ')}"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    >
    <source 
        type="image/webp"
        srcset="${sizes.map(w => `${baseUrl}/${imageName}-${w}w.webp ${w}w`).join(', ')}"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    >
    <img 
        src="${baseUrl}/${imageName}-optimized.jpg" 
        alt="${alt}"
        loading="lazy"
        decoding="async"
    >
</picture>`;
    }

    // Minify JavaScript with tree shaking
    async optimizeJavaScript(code, options = {}) {
        const defaultOptions = {
            compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info'],
                passes: 3
            },
            mangle: {
                toplevel: true,
                reserved: ['$', 'require', 'exports']
            },
            format: {
                comments: false
            },
            sourceMap: options.sourceMap || false
        };

        try {
            const result = await terser.minify(code, defaultOptions);
            return {
                code: result.code,
                map: result.map,
                reduction: ((code.length - result.code.length) / code.length * 100).toFixed(2) + '%'
            };
        } catch (error) {
            console.error('JavaScript optimization error:', error);
            throw error;
        }
    }

    // Optimize CSS with purging
    async optimizeCSS(css, options = {}) {
        const cleanCSS = new CleanCSS({
            level: {
                1: {
                    specialComments: 0
                },
                2: {
                    mergeSemantically: true,
                    restructureRules: true
                }
            }
        });

        const output = cleanCSS.minify(css);
        
        return {
            css: output.styles,
            stats: output.stats,
            reduction: ((css.length - output.styles.length) / css.length * 100).toFixed(2) + '%'
        };
    }

    // Extract and inline critical CSS
    async extractCriticalCSS(html, css) {
        // Simplified critical CSS extraction
        // In production, use tools like critical or penthouse
        const criticalSelectors = [
            'body', 'html', 'header', 'nav', 'main',
            '.hero', '.container', '.btn', '.header'
        ];

        const criticalCSS = css.split('}')
            .filter(rule => criticalSelectors.some(sel => rule.includes(sel)))
            .join('}') + '}';

        return {
            critical: criticalCSS,
            remaining: css.replace(criticalCSS, '')
        };
    }

    // Optimize HTML
    async optimizeHTML(html, options = {}) {
        const minified = await htmlMinifier.minify(html, {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            minifyCSS: true,
            minifyJS: true,
            processConditionalComments: true,
            removeEmptyAttributes: true,
            removeOptionalTags: true,
            ...options
        });

        return {
            html: minified,
            reduction: ((html.length - minified.length) / html.length * 100).toFixed(2) + '%'
        };
    }

    // Generate service worker for caching
    generateServiceWorker() {
        return `
const CACHE_NAME = 'rootuip-v1';
const urlsToCache = [
    '/',
    '/styles/main.css',
    '/scripts/app.js',
    '/manifest.json'
];

// Install service worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Fetch with cache-first strategy for static assets
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

// Clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});`;
    }

    // Generate CDN configuration
    generateCDNConfig() {
        return {
            cloudflare: {
                zone_id: process.env.CLOUDFLARE_ZONE_ID,
                rules: [
                    {
                        match: '*.js',
                        cache_level: 'aggressive',
                        edge_cache_ttl: 7200,
                        browser_cache_ttl: 86400
                    },
                    {
                        match: '*.css',
                        cache_level: 'aggressive',
                        edge_cache_ttl: 7200,
                        browser_cache_ttl: 86400
                    },
                    {
                        match: '*.{jpg,jpeg,png,gif,webp,avif}',
                        cache_level: 'aggressive',
                        edge_cache_ttl: 86400,
                        browser_cache_ttl: 2592000, // 30 days
                        polish: 'lossy'
                    }
                ],
                page_rules: [
                    {
                        url: 'api.rootuip.com/*',
                        cache_level: 'bypass',
                        security_level: 'high'
                    },
                    {
                        url: 'static.rootuip.com/*',
                        cache_level: 'everything',
                        edge_cache_ttl: 86400
                    }
                ],
                optimization: {
                    minify: {
                        javascript: true,
                        css: true,
                        html: true
                    },
                    brotli: true,
                    http2: true,
                    http3: true,
                    early_hints: true
                }
            }
        };
    }

    // Performance budget configuration
    getPerformanceBudget() {
        return {
            metrics: {
                'first-contentful-paint': { budget: 1500, unit: 'ms' },
                'largest-contentful-paint': { budget: 2500, unit: 'ms' },
                'first-input-delay': { budget: 100, unit: 'ms' },
                'cumulative-layout-shift': { budget: 0.1, unit: 'score' },
                'time-to-interactive': { budget: 3500, unit: 'ms' },
                'total-blocking-time': { budget: 300, unit: 'ms' }
            },
            resources: {
                script: { budget: 200, unit: 'kb' },
                style: { budget: 100, unit: 'kb' },
                image: { budget: 1000, unit: 'kb' },
                font: { budget: 100, unit: 'kb' },
                document: { budget: 50, unit: 'kb' },
                total: { budget: 1500, unit: 'kb' }
            }
        };
    }

    // Webpack configuration for optimization
    getWebpackConfig() {
        return {
            mode: 'production',
            optimization: {
                minimize: true,
                minimizer: [
                    // TerserPlugin config
                    {
                        test: /\.js(\?.*)?$/i,
                        parallel: true,
                        terserOptions: {
                            compress: {
                                drop_console: true,
                                drop_debugger: true
                            }
                        }
                    }
                ],
                splitChunks: {
                    chunks: 'all',
                    cacheGroups: {
                        vendor: {
                            test: /[\\/]node_modules[\\/]/,
                            name: 'vendors',
                            priority: 10
                        },
                        common: {
                            minChunks: 2,
                            priority: 5,
                            reuseExistingChunk: true
                        }
                    }
                },
                runtimeChunk: 'single',
                moduleIds: 'deterministic'
            },
            performance: {
                hints: 'error',
                maxEntrypointSize: 250000,
                maxAssetSize: 250000
            }
        };
    }
}

// Resource hints generator
class ResourceHints {
    static generate(resources) {
        const hints = [];
        
        // DNS prefetch for external domains
        const domains = ['https://cdn.rootuip.com', 'https://api.rootuip.com'];
        domains.forEach(domain => {
            hints.push(`<link rel="dns-prefetch" href="${domain}">`);
            hints.push(`<link rel="preconnect" href="${domain}" crossorigin>`);
        });
        
        // Preload critical resources
        if (resources.criticalCSS) {
            hints.push(`<link rel="preload" href="${resources.criticalCSS}" as="style">`);
        }
        
        if (resources.mainJS) {
            hints.push(`<link rel="preload" href="${resources.mainJS}" as="script">`);
        }
        
        // Preload fonts
        if (resources.fonts) {
            resources.fonts.forEach(font => {
                hints.push(`<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin>`);
            });
        }
        
        return hints.join('\n');
    }
}

module.exports = {
    FrontendOptimizer,
    ResourceHints
};