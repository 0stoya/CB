import React from "react";

export function Table(props: React.PropsWithChildren) {
  return (
    <div style={{ overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        {props.children}
      </table>
    </div>
  );
}

export function Th(props: React.PropsWithChildren) {
  return (
    <th style={{ textAlign: "left", opacity: 0.85, fontWeight: 700, padding: "10px 8px", borderBottom: "1px solid #222633" }}>
      {props.children}
    </th>
  );
}

export function Td(props: React.PropsWithChildren<{ right?: boolean; style?: React.CSSProperties }>) {
  return (
    <td
      style={{
        padding: "10px 8px",
        borderBottom: "1px solid #222633",
        verticalAlign: "top",
        textAlign: props.right ? "right" : "left",
        ...(props.style || {})
      }}
    >
      {props.children}
    </td>
  );
}