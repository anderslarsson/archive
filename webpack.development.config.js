const path = require('path');
const webpack = require('webpack');
const Visualizer = require('webpack-visualizer-plugin');


module.exports = {
    entry: [
        'babel-polyfill',
        './src/client/index.js'
    ],

    output: {
        path: path.resolve(__dirname, './src/server/static'),
        filename: 'bundle.js',
        publicPath: '/static'
    },

    devtool: 'source-map',

    plugins: [
        new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, /en|de/),

        new Visualizer({
            filename: './statistics.html'
        })
    ],

    module: {
        rules: [
            {
                test: /\.css$/,
                loader: 'style-loader!css-loader'
            },
            {
                test: /.jsx?$/,
                include: [
                    path.join(__dirname, 'local'),
                    path.join(__dirname, 'src')
                ],
                loader: 'babel-loader',
                options: {
                    compact: false,
                    presets: [
                        [
                            'env', {
                                'targets': {
                                    'node': 8,
                                    'uglify': false
                                },
                                'modules': false
                            }
                        ],
                        'stage-0',
                        'react'
                    ],
                    plugins: ['transform-decorators-legacy']
                }
            }
        ]
    }

};

