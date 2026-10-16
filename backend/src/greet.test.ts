import { expect, test } from "vitest";
import { greet } from "./greet.js";

test("greet says hello to the given name", () => {
  expect(greet("Tribal")).toBe("Hello, Tribal");
});
