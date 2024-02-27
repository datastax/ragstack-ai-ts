/** @type {import('ts-jest').JestConfigWithTsJest} */
/* eslint-disable-next-line */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: "./jest.env.js",
    testTimeout: 120000,
    maxConcurrency: 1,
    setupFiles: ["dotenv/config"],
    detectOpenHandles: true,
    reporters: [
        "default",
        ['<rootDir>/jest-custom-reporter.js', {banana: 'yes', pineapple: 'no'}],
        ["jest-junit", {
            suiteName: "jest tests",
            classNameTemplate: (vars) => {
                return vars.classname.toUpperCase();
            }

        }
        ]
    ]
}
;