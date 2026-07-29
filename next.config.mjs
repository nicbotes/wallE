/** @type {import('next').NextConfig} */
const nextConfig = {
  // The chat route reads the soul/ files from disk at request time, so it must
  // run on the Node.js runtime (not Edge). Declared per-route in the handler.
};

export default nextConfig;
