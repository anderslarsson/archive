const path = require('path');

module.exports = {
    entry: [
        'babel-polyfill',
        './src/client/index.js'
    ],

    output: {
        path: path.resolve(__dirname, './src/server/static'),
        publicPath: '/static',
        filename: 'bundle.js'
        // filename: 'components/[name]-bundle.js',
        // library: 'archive-[name]',
        // libraryTarget: 'umd',
        // umdNamedDefine: true
    },

    bail: true,

    plugins: [
    ],

    resolve: {
        modules: ['node_modules'],
        extensions: ['.js']
    },

    resolveLoader: {
        modules: ['node_modules'],
        extensions: ['.js']
    },

    module: {
        rules: [
            {
                test: /\.css$/,
                loader: "style-loader!css-loader"
            },
            {
                test: /.jsx?$/,
                loader: 'babel-loader',
                include: [
                    path.join(__dirname, 'src')
                ],
                options: {
                    compact: true,
                    presets: [
                        ['env', { 'targets': { 'node': 8, 'uglify': true }, 'modules': false }],
                        'stage-0',
                        'react'
                    ],
                    plugins: ['transform-decorators-legacy']
                }
            }
        ]
    }
};
