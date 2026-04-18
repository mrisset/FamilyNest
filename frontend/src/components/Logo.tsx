interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const sizes = {
  sm: { img: 28, text: 'text-lg' },
  md: { img: 40, text: 'text-2xl' },
  lg: { img: 64, text: 'text-4xl' },
};

export default function Logo({ size = 'md', showText = true }: LogoProps) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-2">
      <img src="/logo.svg" alt="FamilyNest logo" width={s.img} height={s.img} />
      {showText && (
        <span className={`${s.text} font-bold text-stone-900 dark:text-stone-50`} style={{ fontFamily: 'Fraunces, serif' }}>
          Family<span className="text-amber-600">Nest</span>
        </span>
      )}
    </div>
  );
}
