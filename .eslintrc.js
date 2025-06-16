module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true
    },
    parser: '@babel/eslint-parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        requireConfigFile: false,
        babelOptions: {
            presets: ['@babel/preset-env']
        }
    },
    extends: ['scratch', 'scratch/es6', 'scratch/node']
};
