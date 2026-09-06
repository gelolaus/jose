import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  testEnvironment: "node",
  // Auth and curriculum suites both mutate process.env database URLs.
  maxWorkers: 1,
};

export default config;
