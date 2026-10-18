/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Server Actions are stable in Next 15; nothing special needed here.
    // Photo upload posts a File through a Server Action. The 1 MB default would
    // reject a phone photo before the action ever runs, so the ceiling matches
    // the bucket's own limit (5 MiB) plus form overhead.
    serverActions: { bodySizeLimit: '6mb' },
  },
};

export default nextConfig;
