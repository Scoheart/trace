// Next is served by our local-only Node API for a single 127.0.0.1 port.
// No cloud rewrites, external fonts or remote image hosts are needed.
const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd()
  }
};
export default config;
