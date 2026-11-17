/**
 * Mo, the tour's presenter: a rolled-up rug in Modasa's blue, with cream stripes and a fringed flap for an
 * arm. Drawn in SVG; it bobs, blinks, moves its mouth while talking and waves on request.
 */
export function Mascot({ talking, waving, size = 150 }: { talking: boolean; waving: boolean; size?: number }) {
  const fringe = Array.from({ length: 9 }, (_, i) => 35 + i * 6.25);
  return (
    <svg
      viewBox="0 0 130 160"
      width={size}
      height={(size * 160) / 130}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <style>{`
        .mo-bob { animation: mo-bob 2.6s ease-in-out infinite; }
        @keyframes mo-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        .mo-eyes { transform-box: fill-box; transform-origin: center; animation: mo-blink 4.2s infinite; }
        @keyframes mo-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        .mo-mouth-open { transform-box: fill-box; transform-origin: center; animation: mo-talk 0.26s ease-in-out infinite alternate; }
        @keyframes mo-talk { from { transform: scaleY(0.25); } to { transform: scaleY(1); } }
        .mo-arm { transform-box: view-box; transform-origin: 96px 86px; transition: transform 0.3s; }
        .mo-wave { animation: mo-wave 0.5s ease-in-out 4 alternate; }
        @keyframes mo-wave { from { transform: rotate(-38deg); } to { transform: rotate(12deg); } }
        .mo-shadow { animation: mo-shadow 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes mo-shadow { 0%, 100% { transform: scaleX(1); opacity: .18; } 50% { transform: scaleX(.88); opacity: .12; } }
      `}</style>

      <ellipse className="mo-shadow" cx="62" cy="154" rx="34" ry="5" fill="#16335f" />
      <g className="mo-bob">
        {/* Left arm, resting */}
        <g transform="rotate(25 30 92)">
          <rect x="12" y="88" width="20" height="10" rx="3" fill="#1d4fa3" />
          <rect x="12" y="91" width="20" height="2.5" fill="#f3efe6" />
        </g>

        {/* Body: the rolled rug */}
        <rect x="30" y="30" width="64" height="106" rx="12" fill="#1d4fa3" />
        <rect x="30" y="52" width="64" height="7" fill="#f3efe6" />
        <rect x="30" y="61" width="64" height="2.5" fill="#d9a441" />
        <rect x="30" y="108" width="64" height="2.5" fill="#d9a441" />
        <rect x="30" y="112" width="64" height="7" fill="#f3efe6" />
        <rect x="30" y="30" width="10" height="106" rx="5" fill="#16335f" opacity=".25" />

        {/* Top: the end of the roll, showing the spiral */}
        <ellipse cx="62" cy="30" rx="32" ry="11" fill="#16335f" />
        <ellipse cx="62" cy="30" rx="23" ry="7.5" fill="none" stroke="#f3efe6" strokeWidth="2.5" />
        <ellipse cx="62" cy="30" rx="13" ry="4.2" fill="none" stroke="#d9a441" strokeWidth="2.2" />
        <ellipse cx="62" cy="30" rx="4" ry="1.5" fill="#f3efe6" />

        {/* Fringe */}
        {fringe.map((x) => (
          <line key={x} x1={x} y1="135" x2={x} y2="146" stroke="#f3efe6" strokeWidth="2.4" strokeLinecap="round" />
        ))}

        {/* Face */}
        <g className="mo-eyes">
          <ellipse cx="50" cy="78" rx="6.5" ry="7.5" fill="#fff" />
          <ellipse cx="74" cy="78" rx="6.5" ry="7.5" fill="#fff" />
          <circle cx="51.5" cy="79.5" r="3.6" fill="#1c1b19" />
          <circle cx="75.5" cy="79.5" r="3.6" fill="#1c1b19" />
          <circle cx="52.8" cy="77.8" r="1.2" fill="#fff" />
          <circle cx="76.8" cy="77.8" r="1.2" fill="#fff" />
        </g>
        <circle cx="42" cy="91" r="4.5" fill="#f08a7e" opacity=".55" />
        <circle cx="82" cy="91" r="4.5" fill="#f08a7e" opacity=".55" />
        {talking ? (
          <ellipse className="mo-mouth-open" cx="62" cy="94" rx="7" ry="5" fill="#16335f" />
        ) : (
          <path d="M54 92 Q62 99 70 92" fill="none" stroke="#16335f" strokeWidth="2.8" strokeLinecap="round" />
        )}

        {/* Right arm: a fringed flap that waves */}
        <g className={`mo-arm ${waving ? "mo-wave" : ""}`}>
          <rect x="92" y="81" width="26" height="11" rx="3" fill="#1d4fa3" />
          <rect x="92" y="84.5" width="26" height="2.5" fill="#f3efe6" />
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1="118"
              y1={82.5 + i * 2.7}
              x2="124"
              y2={82.5 + i * 2.7}
              stroke="#f3efe6"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ))}
        </g>
      </g>
    </svg>
  );
}
