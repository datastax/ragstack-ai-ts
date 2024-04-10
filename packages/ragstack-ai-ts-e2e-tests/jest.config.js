/** @type {import('ts-jest').JestConfigWithTsJest} */
/* eslint-disable-next-line */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: "./jest.env.js",
    testTimeout: 180000,
    maxConcurrency: 1,
    setupFiles: ["dotenv/config"],
    setupFilesAfterEnv: ["jest-expect-message"],
    detectOpenHandles: true,
    reporters: ["default",
        ["<rootDir>/jest.reporter.js", {}],
        ["jest-junit", {
        suiteName: "RAGStack CI",
        classNameTemplate: "{classname}",
        titleTemplate: "{title}",
        testCasePropertiesFile: "jest.junit.js"
    }]
    ]
}
;