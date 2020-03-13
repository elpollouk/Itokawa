const path = require('path');

module.exports = {
  entry: './src/client/main.ts',
  mode: "production",
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
//        exclude: /node_modules/,
        options: {
          transpileOnly: true
        }
      },
      {
        test: /\.html$/i,
        loader: 'html-loader',
        options: {
          minimize: true,
          conservativeCollapse: false,
        }
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'static'),
  },
};