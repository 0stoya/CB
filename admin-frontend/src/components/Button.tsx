import React from "react";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "default" | "danger" }
) {
  const variant = props.variant ?? "default";

  const background =
    variant === "primary" ? "#1a2340" : variant === "danger" ? "#2a1313" : "#151824";
  const border = variant === "danger" ? "1px solid #5a2b2b" : "1px solid #2a2f3f";

  return (
    <button
      {...props}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border,
        background,
        color: "#e8e8e8",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,
        ...(props.style || {})
      }}
    />
  );
}