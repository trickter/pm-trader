"use client";

import { useFormStatus } from "react-dom";

import { ActionButton } from "@/components/ui/primitives";

export function SubmitButton({
  children,
  pendingLabel = "处理中...",
  tone,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  tone?: "default" | "danger" | "ghost";
}) {
  const { pending } = useFormStatus();

  return (
    <ActionButton type="submit" tone={tone} disabled={pending}>
      {pending ? pendingLabel : children}
    </ActionButton>
  );
}
