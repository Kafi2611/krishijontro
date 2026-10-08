// A big, easy-to-tap box around a hidden radio button or checkbox.
// When its input is checked, the box turns green (Tailwind's "has-checked:" style).
// We use real <input> elements, so React Hook Form can read them with register().
import { cn } from "@/lib/utils";

type OptionCardProps = {
  type?: "radio" | "checkbox";
  inputProps: React.ComponentProps<"input">; // e.g. { value: "PER_ACRE", ...form.register("billingUnit") }
  children: React.ReactNode; // what the box shows: an icon, a label...
  className?: string;
};

export function OptionCard({ type = "radio", inputProps, children, className }: OptionCardProps) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
        "has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        className,
      )}
    >
      <input type={type} className="sr-only" {...inputProps} />
      {children}
    </label>
  );
}
