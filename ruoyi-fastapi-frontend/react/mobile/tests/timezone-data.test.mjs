import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { inflateRawSync } from "node:zlib";
const require = createRequire(import.meta.url);
test("packed timezone data preserves every original record and transition", () => {
  let original;
  vm.runInNewContext(
    fs.readFileSync(
      require.resolve("@formatjs/intl-datetimeformat/add-all-tz.js"),
      "utf8",
    ),
    {
      Intl: {
        DateTimeFormat: {
          __addTZData: (value) => {
            original = JSON.parse(JSON.stringify(value));
          },
        },
      },
    },
  );
  const source = fs.readFileSync(
    new URL("../src/utils/timezoneData.js", import.meta.url),
    "utf8",
  );
  const packed = source.match(/const packed = ['"]([^'"]+)['"]/)?.[1];
  assert.ok(packed);
  assert.deepEqual(
    JSON.parse(inflateRawSync(Buffer.from(packed, "base64")).toString()),
    original,
  );
  assert.ok(Buffer.byteLength(source) < 300000);
});
