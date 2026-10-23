// ZEK logo, traced from the brand board (image.jpg) into vectors so it stays sharp at
// every size and works on light and dark backgrounds. Colors come from --logo-blue and
// --logo-gray in globals.css.

const WORDMARK = {
  viewBox: "0 0 857 252",
  blue: "M319.0 248.5 L320.2 250.8 L506.5 250.8 L533.8 222.5 L533.8 208.2 L532.5 207.0 L320.2 207.0 L319.0 208.2 Z M258.8 173.2 L254.5 167.0 L246.2 164.0 L240.2 166.0 L235.0 172.2 L235.0 176.5 L230.5 178.0 L172.2 178.0 L167.5 174.0 L164.2 174.0 L151.0 188.5 L165.5 188.8 L169.2 184.8 L230.5 184.8 L235.5 181.8 L239.2 186.8 L243.2 188.8 L250.5 188.8 L256.8 184.5 L258.8 180.5 Z M244.2 170.8 L249.5 170.8 L253.0 174.2 L253.0 179.5 L248.5 183.0 L244.2 183.0 L240.8 179.5 L240.8 174.2 Z M645.0 126.2 L643.0 131.2 L643.0 136.5 L648.2 143.8 L652.2 145.8 L664.5 144.8 L704.2 185.8 L712.8 185.5 L709.8 180.2 L667.8 138.5 L668.8 135.5 L667.8 129.2 L661.5 122.0 L652.2 121.0 L649.2 122.0 Z M654.2 126.8 L659.5 127.8 L662.0 131.2 L662.0 136.5 L658.5 140.0 L653.2 140.0 L648.8 134.5 L649.8 130.2 Z M550.5 16.0 L548.2 16.0 L545.0 19.2 L545.0 21.5 L566.0 42.2 L566.0 143.5 L559.0 148.2 L557.0 154.2 L559.0 161.5 L566.0 167.2 L566.0 223.5 L541.0 249.2 L541.2 250.8 L550.5 249.8 L572.8 226.5 L572.8 166.2 L576.5 164.8 L580.8 158.5 L580.8 151.2 L578.8 147.2 L572.8 143.5 L572.8 39.2 Z M568.2 148.8 L572.5 149.8 L575.0 152.2 L575.0 157.5 L570.5 161.0 L565.2 160.0 L562.8 155.5 L563.8 152.2 Z M780.2 2.0 L671.0 113.2 L671.0 125.5 L791.2 249.8 L793.2 250.8 L855.5 250.8 L855.8 248.2 L850.8 242.2 L844.8 237.5 L730.8 120.5 L730.8 118.2 L844.8 3.5 L844.5 2.0 Z M319.0 42.5 L320.2 43.8 L504.5 43.8 L532.8 15.5 L543.8 2.2 L320.2 2.0 L319.0 3.2 Z M64.0 186.5 L125.5 186.8 L275.8 33.5 L275.8 2.2 L39.2 2.0 L39.2 43.8 L199.0 44.2 L64.0 184.2 Z",
  gray: "M2.0 250.5 L256.5 250.8 L275.8 230.5 L275.8 209.2 L105.2 209.0 L121.8 190.5 L121.5 189.0 L67.2 189.0 L66.5 188.0 L63.2 189.0 L61.2 188.0 L17.0 233.2 Z M319.0 143.5 L320.2 145.8 L473.5 145.8 L515.8 102.2 L320.2 102.0 L319.0 103.2 L319.0 117.5 L320.0 118.2 Z M655.5 2.0 L607.0 2.2 L607.2 250.8 L622.5 250.8 L655.8 216.5 L655.8 169.2 L628.8 142.5 L628.8 125.2 L655.8 97.5 Z",
};

const SYMBOL = {
  viewBox: "0 0 237 296",
  blue: "M3.0 173.2 L3.0 181.5 L2.0 182.2 L2.0 190.5 L3.0 191.2 L2.0 223.5 L3.0 225.5 L117.2 294.8 L121.5 294.8 L235.8 224.5 L235.8 184.2 L234.8 182.2 L210.2 182.0 L209.0 183.2 L208.5 210.0 L129.5 259.0 L119.2 264.0 L28.8 208.5 L28.5 156.0 L23.2 158.0 Z M157.0 158.2 L157.0 163.5 L159.0 167.5 L165.2 171.8 L173.5 170.8 L179.2 163.8 L234.5 163.8 L235.8 162.5 L234.5 158.0 L179.2 158.0 L173.5 151.0 L170.5 150.0 L162.2 151.0 Z M165.2 155.8 L170.5 155.8 L173.0 158.2 L173.0 163.5 L170.5 166.0 L166.2 166.0 L162.8 163.5 L162.8 158.2 Z M71.2 88.0 L47.0 112.2 L47.2 113.8 L123.5 113.8 L125.0 116.5 L57.0 184.2 L48.0 194.2 L48.0 196.5 L68.2 210.8 L166.5 210.8 L189.8 187.5 L189.5 186.0 L101.2 186.0 L94.8 184.2 L167.8 110.5 L187.8 88.2 Z M235.8 73.2 L165.5 29.0 L130.2 9.0 L120.5 2.0 L118.2 2.0 L29.5 57.0 L11.2 67.0 L3.0 73.2 L2.0 80.2 L3.0 141.5 L5.5 141.8 L28.8 125.5 L28.8 89.2 L31.2 86.8 L118.2 33.8 L135.5 42.8 L140.2 46.8 L209.0 88.2 L209.2 144.8 L234.5 128.8 L235.8 126.5 Z",
};

type LogoProps = { className?: string; title?: string };

/** The "ZEK" wordmark. Set the size with a height class (e.g. h-6); the width follows. */
export function ZekWordmark({ className = "h-6 w-auto", title }: LogoProps) {
  return (
    <svg viewBox={WORDMARK.viewBox} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path fill="var(--logo-blue)" fillRule="evenodd" d={WORDMARK.blue} />
      <path fill="var(--logo-gray)" fillRule="evenodd" d={WORDMARK.gray} />
    </svg>
  );
}

/** The hexagon "Z" brand symbol (app icon, chat avatar, collapsed admin sidebar). */
export function ZekSymbol({ className = "size-8", title }: LogoProps) {
  return (
    <svg viewBox={SYMBOL.viewBox} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path fill="var(--logo-blue)" fillRule="evenodd" d={SYMBOL.blue} />
    </svg>
  );
}
