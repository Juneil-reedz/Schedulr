import * as React from "react";
import { toHash } from "./routes";

export default function Link({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a href={toHash(href)} {...rest}>
      {children}
    </a>
  );
}
