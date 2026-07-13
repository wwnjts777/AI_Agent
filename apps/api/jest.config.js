/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*(spec|e2e-spec)\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest"
  },
  testEnvironment: "node",
  setupFiles: ["<rootDir>/test/jest-env.ts"]
};
