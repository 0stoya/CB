import React from "react";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        background: "#0f1116",
        color: "#e8e8e8",
        border: "1px solid #2a2f3f",
        borderRadius: 10,
        padding: "10px 12px",
        ...(props.style || {})
      }}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        minHeight: 76,
        resize: "vertical",
        background: "#0f1116",
        color: "#e8e8e8",
        border: "1px solid #2a2f3f",
        borderRadius: 10,
        padding: "10px 12px",
        ...(props.style || {})
      }}
    />
  );
}