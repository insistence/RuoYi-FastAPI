import React from "react";

// Use a native button on H5 so keyboard activation and disabled semantics
// do not depend on Taro's custom-element attributes or adjacent-button styles.
export default function ActionButton({
  children,
  loading,
  size,
  className,
  ...props
}) {
  return (
    <button
      type="button"
      className={`mobile-action-button ${className || "flex min-h-11 items-center justify-center rounded-xl bg-gray-100 px-4 text-sm"}`}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
