/**
 * Every way a pointer drag ends. `blur` matters because neither pointer event fires
 * when the window itself goes away mid-drag — alt-tab, or the OS taking the gesture —
 * and the drag would stay open. Both grids used to bind this list themselves, which is
 * how they drifted apart.
 */
const RELEASE_EVENTS = ["pointerup", "pointercancel", "blur"];

export function bindDragRelease(target, onRelease) {
  for (const name of RELEASE_EVENTS) target.addEventListener(name, onRelease);
  return () => {
    for (const name of RELEASE_EVENTS) target.removeEventListener(name, onRelease);
  };
}
