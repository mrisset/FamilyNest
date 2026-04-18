interface Props { message?: string | null }

export default function FormSuccess({ message }: Props) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-3 py-2.5 rounded-xl animate-fade-in">
      <span className="flex-shrink-0">✓</span>
      <span>{message}</span>
    </div>
  );
}
