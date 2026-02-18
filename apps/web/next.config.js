/** @type {import('next').NextConfig} */
const DEFAULT_SITE_URL = "https://miccheck.qortxai.com";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_SITE_URL;

let siteHost = "miccheck.qortxai.com";
try {
  siteHost = new URL(siteUrl).host;
} catch {
  siteHost = new URL(DEFAULT_SITE_URL).host;
}

const redirectSourceHosts = [
  "miccheck-sage.vercel.app",
  `www.${siteHost}`
].filter((host, index, list) => host !== siteHost && list.indexOf(host) === index);

const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: `https://${siteHost}/:path*`,
        permanent: true
      },
      ...redirectSourceHosts.map((host) => ({
        source: "/:path*",
        has: [{ type: "host", value: host }],
        destination: `https://${siteHost}/:path*`,
        permanent: true
      }))
    ];
  }
};

export default nextConfig;
