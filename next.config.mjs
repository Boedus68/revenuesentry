import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Copia il worker di pdfjs-dist nella cartella public durante il build
    if (!isServer) {
      // Per pdfjs-dist v4+, il worker è in formato .mjs
      const workerPath = join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
      const publicWorkerPath = join(process.cwd(), 'public', 'pdf.worker.min.mjs');
      
      if (existsSync(workerPath) && !existsSync(publicWorkerPath)) {
        try {
          copyFileSync(workerPath, publicWorkerPath);
          console.log('✓ Worker pdfjs-dist (.mjs) copiato in public/');
        } catch (error) {
          console.warn('⚠ Impossibile copiare worker pdfjs-dist:', error);
        }
      }
    }
    return config;
  },
};

export default nextConfig;