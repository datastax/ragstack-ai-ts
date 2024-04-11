/** @type {import('ts-jest').JestConfigWithTsJest} */
/* eslint-disable-next-line */
module.exports = {
  preset: 'ts-jest',
  testTimeout: 180000,
  setupFiles: ["dotenv/config"],
  detectOpenHandles: true,
}
