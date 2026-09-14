/**
 * The house mark: a bottle inside a gold-ruled lozenge.
 *
 * Drawn rather than imported so it stays crisp at any size, inherits
 * currentColor for the linework, and adds no network request to the header.
 */

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
    >
      {/* Lozenge frame */}
      <path
        d="M24 2 L44 24 L24 46 L4 24 Z"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.35"
      />
      <path
        d="M24 7 L39 24 L24 41 L9 24 Z"
        stroke="var(--color-accent)"
        strokeWidth="0.9"
      />
      {/* Bottle */}
      <rect x="21.5" y="13" width="5" height="3.4" rx="0.6" fill="var(--color-accent)" />
      <path
        d="M19.6 17.8 h8.8 a1.6 1.6 0 0 1 1.6 1.6 v9.4 a3.2 3.2 0 0 1 -3.2 3.2 h-5.6 a3.2 3.2 0 0 1 -3.2 -3.2 v-9.4 a1.6 1.6 0 0 1 1.6 -1.6 z"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M20 24.4 h8 v4.4 a2.6 2.6 0 0 1 -2.6 2.6 h-2.8 a2.6 2.6 0 0 1 -2.6 -2.6 z"
        fill="var(--color-accent)"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Full lockup: mark + wordmark. `stacked` is used in the footer where there is
 * vertical room; the header uses the inline form.
 */
export function Logo({
  className = '',
  stacked = false,
}: {
  className?: string;
  stacked?: boolean;
}) {
  return (
    <span
      className={[
        'inline-flex items-center text-brand',
        stacked ? 'flex-col gap-2.5 text-center' : 'gap-2.5 sm:gap-3',
        className,
      ].join(' ')}
    >
      <LogoMark className={stacked ? 'h-11 w-11 shrink-0' : 'h-8 w-8 shrink-0 sm:h-9 sm:w-9'} />
      <span className={stacked ? 'flex flex-col items-center' : 'flex flex-col'}>
        <span
          className="font-[family-name:var(--font-display)] text-[1.0625rem] leading-none font-medium tracking-[0.01em] sm:text-xl"
          style={{ fontVariantNumeric: 'lining-nums' }}
        >
          Attar World
        </span>
        <span className="aw-eyebrow aw-eyebrow-accent mt-1 text-[0.5625rem] leading-none sm:text-[0.625rem]">
          Sonar Bangla
        </span>
      </span>
    </span>
  );
}
