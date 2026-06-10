import { expect, it } from "vitest";

import { uniqueBy } from "../src/domain/deduplicate.js";

it("keeps the first item for each non-empty key", () => {
  const result = uniqueBy(
    [
      { email: "person@example.com", name: "First" },
      { email: "person@example.com", name: "Duplicate" },
      { email: "", name: "Missing key" },
    ],
    (item) => item.email || null,
  );

  expect(result).toEqual([{ email: "person@example.com", name: "First" }]);
});
