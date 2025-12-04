const commonjs = require('@rollup/plugin-commonjs');
const { nodeResolve } = require('@rollup/plugin-node-resolve');

const plugins = [
    nodeResolve({
        ignoreGlobal: true
    }),
    commonjs({ ignore: [], sourceMap: false }),
]

module.exports = [
    {
        input: 'src/content_scripts/content.js',
        output: {
            format: 'iife',
            dir: 'dist/content_scripts',
            name: 'WebPFlashDetector'
        },
        plugins
    },
    {
        input: 'src/background/service-worker.js',
        output: {
            format: 'iife',
            dir: 'dist/background',
            name: 'WebPFlashDetector'
        },
        plugins
    }
];