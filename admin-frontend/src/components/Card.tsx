import React from "react";

export function Card(
  props: React.PropsWithChildren<{ title?: string; right?: React.ReactNode }>
) {
  return (
    <div
      style={{
        background: "#111318",
        border: "1px solid #222633",
        borderRadius: 14,
        padding: 14
      }}
    >
      {(props.title || props.right) && (
        <div className="spread" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {props.title ?? ""}
          </div>
          {props.right}
        </div>
      )}
      {props.children}
    </div>
  );
}