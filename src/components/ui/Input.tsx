import { cn } from "@/lib/utils";

type FieldProps = {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

const fieldBase =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-100";

function Label({ label, required }: { label?: string; required?: boolean }) {
  if (!label) return null;
  return (
    <label className="mb-1 block text-sm font-medium text-gray-700">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

function FieldNote({ error, hint }: { error?: string; hint?: string }) {
  if (error) return <p className="mt-1 text-xs text-red-600">{error}</p>;
  if (hint) return <p className="mt-1 text-xs text-gray-500">{hint}</p>;
  return null;
}

export function Input({
  label,
  error,
  hint,
  required,
  className,
  ...rest
}: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="w-full">
      <Label label={label} required={required} />
      <input
        className={cn(fieldBase, error && "border-red-400", className)}
        {...rest}
      />
      <FieldNote error={error} hint={hint} />
    </div>
  );
}

export function Textarea({
  label,
  error,
  hint,
  required,
  className,
  ...rest
}: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="w-full">
      <Label label={label} required={required} />
      <textarea
        className={cn(fieldBase, "min-h-24", error && "border-red-400", className)}
        {...rest}
      />
      <FieldNote error={error} hint={hint} />
    </div>
  );
}

export function Select({
  label,
  error,
  hint,
  required,
  className,
  children,
  ...rest
}: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="w-full">
      <Label label={label} required={required} />
      <select
        className={cn(fieldBase, error && "border-red-400", className)}
        {...rest}
      >
        {children}
      </select>
      <FieldNote error={error} hint={hint} />
    </div>
  );
}
