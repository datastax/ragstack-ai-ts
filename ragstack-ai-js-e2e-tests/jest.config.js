/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testTimeout: 120000,
    reporters: ["default", ["jest-junit", { suiteName: "jest tests", outputDirectory: "results" }]]
};