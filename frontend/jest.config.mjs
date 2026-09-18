import nextJest from "next/jest.js";

// next/jest wires up SWC transforms, CSS/image mocking, and env loading to
// match the actual Next.js build — plain ts-jest/babel-jest configs tend to
// drift from that over time.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
};

export default createJestConfig(customJestConfig);
