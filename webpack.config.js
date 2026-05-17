const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');

/**
 * Resolve flux-plugins-common for webpack helpers and @flux-plugins-common aliases.
 * Prefer monorepo sibling, then FLUX_PLUGINS_COMMON_PATH, then vendor-prefixed fallback.
 *
 * @since 1.6.4
 * @return {string}
 */
function findFluxPluginsCommonDir() {
  const envPath = process.env.FLUX_PLUGINS_COMMON_PATH;
  const possiblePaths = [
    envPath ? path.resolve(envPath) : null,
    path.resolve(__dirname, '../../../flux-plugins-common'),
    path.resolve(__dirname, '../../flux-plugins-common'),
    path.resolve(__dirname, 'vendor-prefixed/stratease/flux-plugins-common'),
  ].filter(Boolean);

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath) && fs.existsSync(path.join(possiblePath, 'webpack.config.helpers.js'))) {
      return possiblePath;
    }
  }

  return path.resolve(__dirname, '../../../flux-plugins-common');
}

const commonLibDir = findFluxPluginsCommonDir();
const commonJsSrc = path.join(commonLibDir, 'src/assets/js/src');
const commonImages = path.join(commonLibDir, 'src/assets/images');
const { createBaseWebpackConfig } = require(path.join(commonLibDir, 'webpack.config.helpers'));

/**
 * Flux One admin bundles only. Suite License/Logs/compatibility bundles are built in
 * flux-plugins-common and copied to src/assets/common/js/dist via composer copy-common-assets.
 *
 * @since 1.6.4
 */
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
                      '@flux-plugins-common/images': commonImages,
                      '@flux-plugins-common': commonJsSrc,
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

module.exports = {
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
      '@flux-plugins-common': commonJsSrc,
      '@flux-plugins-common/images': commonImages,
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
