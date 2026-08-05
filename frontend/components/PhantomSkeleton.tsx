"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import type { PhantomUiAttributes } from "@aejkatappaja/phantom-ui";

type PhantomSkeletonProps = PhantomUiAttributes & {
  children: ReactNode;
};

/**
 * Client-side wrapper for the <phantom-ui> skeleton loader.
 *
 * phantom-ui is a Web Component that needs browser APIs to measure the DOM,
 * so the element module is imported dynamically (client-only) after mount.
 * `loading` toggles the shimmer overlay; the slotted children are the real
 * content structure that phantom-ui measures to build perfectly-aligned
 * skeleton blocks.
 *
 * Example:
 *   <PhantomSkeleton loading={isLoading} animation="shimmer" reveal={0.3}>
 *     <div className="card">...real content...</div>
 *   </PhantomSkeleton>
 */
export default function PhantomSkeleton({
  children,
  loading,
  animation = "shimmer",
  reveal = 0.3,
  ...attrs
}: PhantomSkeletonProps) {
  useEffect(() => {
    void import("@aejkatappaja/phantom-ui");
  }, []);

  return (
    <phantom-ui loading={loading} animation={animation} reveal={reveal} {...attrs}>
      {children}
    </phantom-ui>
  );
}
