import * as React from "react";

// Renamed from useIsLandscape (Brief 42-korrektur · 16. sep 2026).
//
// The old name lied — this hook has never been a device-orientation
// check. It is a pure `matchMedia("(min-width: 1024px)")` check,
// answering the question "is the viewport wide enough to fit the
// three-column customer / master-detail layout, including its
// right-hand rail?" A phone in landscape (932×430) is `false`,
// not `true`. The lookup name now says what the hook does.
//
// The 1024 px threshold is the point where iPad landscape lands the
// three-column layout in a readable width. Anything below (portrait
// iPad, mobile) falls back to the single-column variant.
const SIDE_RAIL_MIN_WIDTH = 1024;

export function useHasSideRail(): boolean {
  const [hasSideRail, setHasSideRail] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= SIDE_RAIL_MIN_WIDTH;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${SIDE_RAIL_MIN_WIDTH}px)`);
    const onChange = () => setHasSideRail(mql.matches);
    mql.addEventListener("change", onChange);
    setHasSideRail(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return hasSideRail;
}
