"use client";
/* shadcn-style primitives on Radix, reworked as glazed clay. */
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog as D, Popover as P, Switch as S } from "radix-ui";
import * as React from "react";
import { twMerge } from "tailwind-merge";
import { X } from "@/components/icons";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

const button = cva(
  "press inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
  {
    variants: {
      tone: {
        primary: "bg-terracotta text-on-dark shadow-raise hover:bg-terracotta-deep",
        forest: "bg-forest text-on-dark shadow-raise hover:bg-forest-soft",
        clay: "bg-cream text-ink shadow-raise hover:bg-cream-deep",
        ghost: "text-ink hover:bg-[color-mix(in_oklab,var(--sand)_35%,transparent)]",
        danger: "text-danger hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]",
      },
      size: {
        sm: "h-9 px-3.5 text-sm rounded-[14px]",
        md: "h-11 px-5 text-base rounded-[16px]",
        icon: "h-10 w-10 rounded-[14px]",
        iconSm: "h-8 w-8 rounded-[12px]",
      },
    },
    defaultVariants: { tone: "clay", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, tone, size, type = "button", ...p }, ref) => (
  <button ref={ref} type={type} className={cn(button({ tone, size }), className)} {...p} />
));
Button.displayName = "Button";

/** A tactile clay toggle, like the switches on the reference's focus tile. */
export function Toggle({
  checked, onChange, label, color = "sage", id,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; color?: "sage" | "terracotta" | "marigold"; id?: string }) {
  const on = { sage: "data-[state=checked]:bg-forest-soft", terracotta: "data-[state=checked]:bg-terracotta", marigold: "data-[state=checked]:bg-marigold" }[color];
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className={cn(
        "relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full bg-sand shadow-sunk transition-[background-color] duration-200",
        on,
      )}
    >
      <S.Thumb className="block h-[20px] w-[20px] translate-x-[3px] rounded-full bg-cream shadow-knob transition-transform duration-[260ms] ease-[var(--ease-out)] data-[state=checked]:translate-x-[23px]" />
    </S.Root>
  );
}

export const inputBase =
  "w-full min-w-0 rounded-[14px] bg-[color-mix(in_oklab,var(--cream)_70%,white)] px-3.5 py-2.5 text-base text-ink shadow-sunk placeholder:text-muted/70 focus-visible:outline-[3px] focus-visible:outline-forest";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(inputBase, "h-11", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(inputBase, "min-h-[84px] resize-y leading-relaxed", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(inputBase, "h-11 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%23392C24%22 stroke-width=%222%22 fill=%22none%22/></svg>')] bg-[right_14px_center] bg-no-repeat pr-9", className)} {...p}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** A row of mutually exclusive choices. */
export function Segmented<T extends string>({
  value, onChange, options, label, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-[16px] bg-cream-deep p-1 shadow-sunk", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "press h-9 rounded-[12px] px-3.5 text-sm font-semibold text-muted",
            value === o.value && "bg-cream text-ink shadow-raise",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, color }: { active?: boolean; onClick?: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      className={cn(
        "press inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold",
        active ? "bg-forest text-on-dark shadow-raise" : "bg-cream-deep text-ink shadow-sunk",
      )}
    >
      {color && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

export function Modal({
  open, onOpenChange, title, description, children, footer, wide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--espresso)_32%,transparent)] backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                className={cn(
                  "clay shape-b fixed left-1/2 top-1/2 z-50 flex max-h-[min(88dvh,860px)] w-[min(94vw,560px)] flex-col",
                  wide && "w-[min(94vw,820px)]",
                )}
                style={{ x: "-50%", y: "-50%" }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-4 px-7 pb-3 pt-6">
                  <div className="min-w-0">
                    <D.Title className="display text-4xl leading-tight text-forest">{title}</D.Title>
                    {description ? (
                      <D.Description className="mt-1 text-base text-muted">{description}</D.Description>
                    ) : (
                      <D.Description className="sr-only">{title}</D.Description>
                    )}
                  </div>
                  <D.Close asChild>
                    <Button tone="ghost" size="icon" aria-label="Close">
                      <X size={20} />
                    </Button>
                  </D.Close>
                </div>
                <div className="soft-scroll min-h-0 flex-1 overflow-y-auto px-7 pb-4">{children}</div>
                {footer && <div className="flex flex-wrap items-center gap-2 border-t border-line px-7 py-4">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 py-2">
      <p className="text-md font-semibold text-ink">{title}</p>
      {children && <p className="max-w-[46ch] text-base text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("display text-2xl leading-tight text-forest", className)}>{children}</h2>;
}

/** A small "?" that explains what a card is for, only when asked. */
export function Help({ title, children, onDark, className }: { title: string; children: React.ReactNode; onDark?: boolean; className?: string }) {
  return (
    <P.Root>
      <P.Trigger asChild>
        <button
          type="button"
          aria-label={`What is ${title} for?`}
          className={cn(
            "press grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold",
            onDark ? "bg-on-dark/20 text-on-dark hover:bg-on-dark/30" : "bg-cream-deep text-forest shadow-sunk hover:bg-sand/60",
            className,
          )}
        >
          ?
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="clay shape-tile z-[60] w-[min(320px,90vw)] px-4 py-3.5 text-sm text-ink data-[state=open]:animate-[help-in_160ms_var(--ease-out)]"
        >
          <p className="mb-1 font-semibold text-forest">{title}</p>
          <div className="space-y-1.5 text-muted">{children}</div>
          <P.Arrow className="fill-cream" />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
