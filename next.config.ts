import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ['@libsql/client', 'undici'],
};

export default withWorkflow(nextConfig);
