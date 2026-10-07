/** The drag-release binding shared by the availability grid and the date picker. */
import test from "node:test";
import assert from "node:assert/strict";
import { bindDragRelease } from "../../src/lib/meet/drag.js";

test("a drag ends when the window loses focus, not just on release", () => {
  const bound = new Map();
  const target = {
    addEventListener: (name, fn) => bound.set(name, fn),
    removeEventListener: (name) => bound.delete(name),
  };

  let ended = 0;
  const unbind = bindDragRelease(target, () => (ended += 1));

  // blur is the one that used to be missing on the availability grid: alt-tabbing
  // mid-drag fires neither pointerup nor pointercancel, so the drag stayed open and
  // the next mouse move kept painting.
  for (const name of ["pointerup", "pointercancel", "blur"]) {
    assert.ok(bound.has(name), `${name} should end a drag`);
    bound.get(name)();
  }
  assert.equal(ended, 3);

  unbind();
  assert.equal(bound.size, 0, "every listener should be removed on cleanup");
});
