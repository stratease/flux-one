const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');

function findFluxPluginsCommonDir() {
  const possiblePaths = [
    path.resolve(__dirname, '../../flux-plugins-common'),
    path.resolve(__dirname, 'vendor-prefixed/stratease/flux-plugins-common'),
    path.resolve(__dirname, '../../../flux-plugins-common'),
  ];

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath) && fs.existsSync(path.join(possiblePath, 'webpack.config.helpers.js'))) {
      return possiblePath;
    }
  }

  return path.resolve(__dirname, '../../flux-plugins-common');
}

const commonLibDir = findFluxPluginsCommonDir();
const { createBaseWebpackConfig } = require(path.join(commonLibDir, 'webpack.config.helpers'));

/**
 * Flux Suite admin pages shipped from this plugin’s `src/assets/common` tree (License, Logs).
 * Output must stay under `src/assets/common/js/dist/` for `MenuService` asset URLs.
 *
 * @since 1.4.2
 */
const suiteCommonPagesConfig = {
  ...createBaseWebpackConfig({
    pluginDir: __dirname,
    pluginSlug: 'flux-one',
    extends: {
      resolve: {
        alias: {
          '@flux-plugins-common': path.resolve(__dirname, 'src/assets/common/js/src'),
          '@flux-plugins-common/images': path.join(commonLibDir, 'src/assets/images'),
        },
      },
    },
  }),
  entry: {
    'logs-page': './src/assets/common/js/src/admin/logs-page.js',
    'license-page': './src/assets/common/js/src/admin/license-page.js',
  },
  output: {
    path: path.resolve(__dirname, 'src/assets/common/js/dist'),
    filename: '[name].bundle.js',
    clean: false,
  },
  plugins: [],
};

const baseConfig = createBaseWebpackConfig({
  pluginDir: __dirname,
  pluginSlug: 'flux-one',
  extends: {
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules\/(?!(?:@mui|@emotion)\/).*/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: {
                    browsers: ['> 1%', 'last 2 versions'],
                  },
                }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                ['@babel/preset-typescript', {}],
              ],
              plugins: [
                [
                  'babel-plugin-module-resolver',
                  {
                    alias: {
                      '@flux-one': path.resolve(__dirname, 'assets/js/src'),
                      '@flux-plugins-common/images': path.join(commonLibDir, 'src/assets/images'),
                      '@flux-plugins-common': path.join(commonLibDir, 'src/assets/js/src'),
                    },
                  },
                ],
              ],
            },
          },
        },
      ],
    },
  },
});

const mainAdminConfig = {
  ...baseConfig,
  entry: {
    'admin-loader': './assets/js/src/admin/loader.ts',
    admin: './assets/js/src/admin/index.tsx',
    'plugin-app': './assets/js/src/admin/plugin-app.tsx',
  },
  output: {
    ...baseConfig.output,
    path: path.resolve(__dirname, 'assets/js/dist'),
    filename: '[name].bundle.js',
    clean: true,
  },
  resolve: {
    ...baseConfig.resolve,
    modules: [
      path.resolve(__dirname, 'node_modules'),
      path.join(commonLibDir, 'node_modules'),
      'node_modules',
    ],
    alias: {
      ...baseConfig.resolve.alias,
      '@flux-one': path.resolve(__dirname, 'assets/js/src'),
      '@flux-plugins-common': path.join(commonLibDir, 'src/assets/js/src'),
      '@flux-plugins-common/images': path.join(commonLibDir, 'src/assets/images'),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './assets/js/src/admin/index.html',
      filename: 'admin.html',
      chunks: ['admin'],
    }),
    new HtmlWebpackPlugin({
      template: './assets/js/src/admin/plugin-app.html',
      filename: 'plugin-app.html',
      chunks: ['plugin-app'],
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'assets/js/dist'),
    },
    compress: true,
    port: 3004,
    allowedHosts: 'all',
    host: '0.0.0.0',
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
  },
  externals: {
    ...baseConfig.externals,
    '@wordpress/icons': 'wp.icons',
  },
};

module.exports = [mainAdminConfig, suiteCommonPagesConfig];

