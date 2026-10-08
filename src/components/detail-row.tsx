// One "label: value" line inside a <dl> details list (e.g. "Rate: 2,400 Tk / acre").
// Put several inside <dl>...</dl>; a thin line separates them.
export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
