"use client";

import { SubmitButton } from "@/components/forms/submit-button";

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingLabel = "处理中...",
  tone,
}: {
  children: React.ReactNode;
  confirmMessage: string;
  pendingLabel?: string;
  tone?: "default" | "danger" | "ghost";
}) {
  return (
    <SubmitButton
      pendingLabel={pendingLabel}
      tone={tone}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </SubmitButton>
  );
}
