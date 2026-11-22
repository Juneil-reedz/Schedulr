import { useEffect, useState } from "react";
import { currentPath } from "./routes";

export function usePathname() {
  const [p, setP] = useState(currentPath());
  useEffect(() => {
    const on = () => setP(currentPath());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return p;
}
