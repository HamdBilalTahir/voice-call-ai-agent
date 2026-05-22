"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** On mobile renders as a bottom sheet (slides up, rounded top, full width) */
  mobileSheet?: boolean;
}

function Dialog({
  open,
  onClose,
  children,
  className,
  mobileSheet,
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        mobileSheet
          ? "items-end justify-center sm:items-center sm:p-4"
          : "items-center justify-center p-4",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal
        className={cn(
          "relative z-10 w-full bg-card border border-border shadow-xl",
          mobileSheet
            ? "rounded-t-2xl sm:rounded-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 fade-in-0 duration-200 sm:max-w-lg"
            : "max-w-lg rounded-2xl animate-in zoom-in-95 fade-in-0 duration-200",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-start justify-between px-6 pt-6 pb-4",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

function DialogClose({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClose}
      aria-label="Close dialog"
      className={cn(
        "rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        className,
      )}
    >
      <X className="size-4" />
    </button>
  );
}

function DialogContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-4", className)} {...props} />;
}

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 px-6 pb-6 pt-2",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogContent,
  DialogFooter,
};
