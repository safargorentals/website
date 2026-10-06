// The Drive Kochi logo: a yellow diamond turn sign (LogoMark) and the
// wordmark "drive kochi" with a steering wheel as the "o" (LogoWord).
// Colours follow the light/dark theme (see .dk-logo in index.css). The
// wordmark is hidden from screen readers; give the surrounding link an
// aria-label instead.

export function LogoMark({ size = 32 }) {
  return (
    <svg className="dk-mark" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <rect className="dk-mark__sign" x="17" y="17" width="66" height="66" rx="10" transform="rotate(45 50 50)" />
      <path
        className="dk-mark__arrow"
        d="M7 20V11a3 3 0 0 1 3-3h8M14 4l4 4-4 4"
        transform="translate(50 50) scale(2.2) translate(-12.5 -12)"
      />
    </svg>
  )
}

function Wheel() {
  return (
    <svg className="dk-word__wheel" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="40" strokeWidth="13" />
      <path d="M14 54H86M50 54V88" strokeWidth="10" />
      <circle className="dk-word__hub" cx="50" cy="54" r="12" />
    </svg>
  )
}

export function LogoWord({ tagline = false }) {
  return (
    <span className="dk-word" aria-hidden="true">
      <span className="dk-word__name">
        <span className="dk-word__drive">drive</span>
        <span className="dk-word__kochi">
          k<Wheel />chi
        </span>
      </span>
      {tagline && <span className="dk-word__tag">By AVS Rent A Car</span>}
    </span>
  )
}

// Mark and wordmark side by side
export default function Logo({ size, tagline = false }) {
  return (
    <>
      <LogoMark size={size} />
      <LogoWord tagline={tagline} />
    </>
  )
}
