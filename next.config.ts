import type { NextConfig } from 'next';

/**
 * The admin panel is its own deployment, on its own subdomain.
 *
 * Because every route here is staff-only, the noindex and no-store headers
 * apply to the WHOLE app rather than to an /admin/* subtree. There is no
 * customer-facing page in this build at all — which is the point of the split:
 * an XSS bug in the shop cannot reach an admin token that lives on a different
 * origin, and shoppers never download the admin bundle.
 */
function remotePatterns(): NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> {
  const patterns: NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> = [];

  const candidates = [
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      patterns.push({
        protocol: url.protocol === 'http:' ? 'http' : 'https',
        hostname: url.hostname,
      });
    } catch {
      // A malformed env var must not break the build.
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: remotePatterns(),
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // DENY, not SAMEORIGIN: nothing should ever frame the admin panel.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};

export default nextConfig;
