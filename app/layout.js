import "./globals.css";

export const metadata = {
  title: "Macro Coaching With Liz",
  description: "No BS. No guesswork. Real timelines and results that stick.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
