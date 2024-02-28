/** @type {import('ts-jest').JestConfigWithTsJest} */
/* eslint-disable-next-line */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: "./jest.env.js",
    testTimeout: 120000,
    maxConcurrency: 1,
    setupFiles: ["dotenv/config"],
    detectOpenHandles: true,
    reporters: [ "default",["jest-junit", { suiteName: "RAGStack CI", classNameTemplate: "{title}", titleTemplate: "{title}"}]
    ]
}
;