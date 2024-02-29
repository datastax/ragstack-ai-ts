module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    root: true,
    ignorePatterns: ['jest*js'],
    rules: {
        "jest/valid-expect": [
            "error",
            {
                "maxArgs": 2
            }
        ]
    }
};