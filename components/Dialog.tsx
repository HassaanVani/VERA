"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native dialogs provide focus containment and make the background inert. */
export default function Dialog({
  children,
  titleId,
  label,
  onDismiss,
  locked = false,
  className = "",
}: {
  children: ReactNode;
  titleId?: string;
  label?: string;
  onDismiss: () => void;
  locked?: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
