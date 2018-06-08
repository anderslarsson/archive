const path = require('path');
const webpack = require('webpack');
// const Config = require('webpack-config').default;

// module.exports = new Config().extend('webpack.base.config.js').merge({
module.exports = {
  entry: [
    './src/client/index.js'
  ],

  output: {
    // path: process.cwd() + '/src/server/static',
    path: path.resolve(__dirname, './src/server/static'),
    filename: 'bundle.js',
    publicPath: '/static'
  },

  module: {
    rules: [
      {
        test: /\.css$/,
        loader: "style-loader!css-loader"
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
                'targets': { 'node': 8, 'uglify': true }, 'modules': false 
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

