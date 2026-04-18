interface Props { message?: string | null }

export default function FormError({ message }: Props) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2.5 rounded-xl animate-fade-in">
      <span className="flex-shrink-0">⚠</span>
      <span>{message}</span>
    </div>
  );
}
