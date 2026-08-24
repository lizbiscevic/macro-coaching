import Link from "next/link";

export default function LegalLayout({ title, updated, children }) {
  return (
    <div className="legal">
      <Styles />
      <header className="legal-head">
        <Link href="/" className="mark">
          Macro Coaching With Liz
        </Link>
        <Link href="/" className="legal-back">
          ← back home
        </Link>
      </header>
      <main className="legal-main">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated {updated}</p>
        {children}
      </main>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
.legal{background:var(--ink);color:var(--chalk);font-family:var(--body);min-height:100vh}
.legal-head{max-width:700px;margin:0 auto;padding:26px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--edge)}
.legal-head .mark{font-family:var(--display);font-size:19px}
.legal-back{font-family:var(--mono);font-size:12px;color:var(--mute)}
.legal-main{max-width:700px;margin:0 auto;padding:40px 20px 80px}
.legal-main h1{font-family:var(--display);font-weight:600;font-size:clamp(28px,5vw,40px);margin:0 0 6px;letter-spacing:-.02em}
.legal-updated{font-family:var(--mono);font-size:12px;color:var(--mute);margin:0 0 32px}
.legal-main h2{font-family:var(--display);font-weight:600;font-size:20px;margin:32px 0 12px}
.legal-main p{font-size:15px;line-height:1.65;color:#4A4550;margin:0 0 14px}
.legal-main ul{margin:0 0 14px;padding-left:20px}
.legal-main li{font-size:15px;line-height:1.65;color:#4A4550;margin-bottom:8px}
.legal-main strong{color:var(--chalk)}
.legal-main a{color:var(--sage);text-decoration:underline;text-underline-offset:3px}
.legal-note{margin-top:40px;padding:16px 18px;background:var(--tide);border-left:2px solid var(--sage);border-radius:2px;font-size:13.5px;line-height:1.6;color:var(--mute)}
    `}</style>
  );
}
