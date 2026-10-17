import test from "node:test";
import assert from "node:assert/strict";
import {
  initialCrop,
  moveCrop,
  resizeCrop,
  sourceCrop,
} from "../src/utils/avatarCrop.js";
test("crop remains within the actual image and maps to original pixels", () => {
  const crop = initialCrop(300, 150);
  assert.equal(crop.width, crop.height);
  const moved = moveCrop(crop, 10000, -10000, 300, 150);
  assert.equal(moved.x + moved.width, 300);
  assert.equal(moved.y, 0);
  const resized = resizeCrop(moved, 10000, -10000, 300, 150);
  assert.equal(resized.width, 300 - moved.x);
  assert.equal(resized.height, 24);
  assert.deepEqual(
    sourceCrop(
      { x: 20, y: 10, width: 50, height: 40 },
      { width: 300, height: 150 },
      { width: 1200, height: 600 },
    ),
    { x: 80, y: 40, width: 200, height: 160 },
  );
});

test("each crop edge resizes independently and stays inside the image", () => {
  const crop = { x: 40, y: 30, width: 120, height: 80 };
  assert.deepEqual(resizeCrop(crop, -20, 99, 300, 200, "left"), {
    x: 20,
    y: 30,
    width: 140,
    height: 80,
  });
  assert.deepEqual(resizeCrop(crop, 99, -10, 300, 200, "top"), {
    x: 40,
    y: 20,
    width: 120,
    height: 90,
  });
  assert.deepEqual(resizeCrop(crop, 20, 99, 300, 200, "right"), {
    x: 40,
    y: 30,
    width: 140,
    height: 80,
  });
  assert.deepEqual(resizeCrop(crop, 99, 10, 300, 200, "bottom"), {
    x: 40,
    y: 30,
    width: 120,
    height: 90,
  });
  for (const edge of ["left", "top", "right", "bottom", "bottom-right"]) {
    for (const delta of [-10000, 10000]) {
      const next = resizeCrop(crop, delta, delta, 300, 200, edge);
      assert.ok(
        next.x >= 0 &&
          next.y >= 0 &&
          next.x + next.width <= 300 &&
          next.y + next.height <= 200,
      );
      assert.ok(next.width >= 24 && next.height >= 24);
    }
  }
});
