export default function robots() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.yourmacrojourney.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/portal", "/coach", "/api", "/login", "/auth"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
