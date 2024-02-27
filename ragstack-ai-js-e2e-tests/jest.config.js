/** @type {import('ts-jest').JestConfigWithTsJest} */
/* eslint-disable-next-line */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: "./jest.env.js",
  testTimeout: 120000,
  maxConcurrency: 1,
  setupFiles: ["dotenv/config"],
};