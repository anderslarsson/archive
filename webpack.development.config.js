const path = require('path');

module.exports = {
    entry: [
        './src/client/index.js'
    ],

    output: {
        path: path.resolve(__dirname, './src/server/static'),
        filename: 'bundle.js',
        publicPath: '/static'
    },

    devtool: 'source-map',

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

