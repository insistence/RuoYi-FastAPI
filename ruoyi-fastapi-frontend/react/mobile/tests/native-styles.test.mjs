import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { nativeStyles } from "../src/utils/nativeStyles.js";
test("native equivalents cover every literal utility used by the mobile pages", () => {
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith(".jsx"))
        for (const match of readFileSync(file, "utf8").matchAll(
          /className="([^"]+)"/g,
        ))
          assert.deepEqual(
            nativeStyles(match[1]).unknown,
            [],
            `${file}: ${match[1]}`,
          );
    }
  }
  visit(
    new URL("../src/pages/", import.meta.url).pathname.replace(
      /^\/([A-Z]:)/,
      "$1",
    ),
  );
});
test("native grid, gradient, opacity colors and fractional spacing retain layout values", () => {
  const result = nativeStyles(
    "grid grid-cols-4 gap-x-2 gap-y-6 bg-linear-to-r from-blue-500 to-indigo-600 text-white/50 -mt-12 top-2.5",
  );
  assert.equal(result.meta.columns, 4);
  assert.equal(result.meta.from, "#3b82f6");
  assert.equal(result.meta.to, "#4f46e5");
  assert.equal(result.style.columnGap, 8);
  assert.equal(result.style.rowGap, 24);
  assert.equal(result.style.marginTop, -48);
  assert.equal(result.style.top, 10);
  assert.equal(result.style.color, "rgba(255,255,255,0.5)");
});
