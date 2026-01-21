const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = function (options, webpack) {
  return {
    ...options,
    externals: [
      nodeExternals({
        // IMPORTANT: Whitelist your local monorepo packages so they ARE bundled.
        // Everything else stays external (loaded from node_modules).
        modulesDir: path.resolve(__dirname, '../../node_modules'),
        allowlist: [/^@agora/], 
      }),
    ],
  };
};
