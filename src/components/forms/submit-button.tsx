"use client";

import { useFormStatus } from "react-dom";

import { ActionButton } from "@/components/ui/primitives";

export function SubmitButton({
  children,
  pendingLabel = "处理中...",
  tone,
  ...props
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  tone?: "default" | "danger" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();

  return (
    <ActionButton type="submit" tone={tone} {...props} disabled={pending || props.disabled}>
      {pending ? pendingLabel : children}
    </ActionButton>
  );
}
