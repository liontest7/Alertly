## Infrastructure
- **Production**: Render (Web Service + Worker + PostgreSQL)
- **Development**: Replit (Next.js with --turbo)
- **Database**: Single Render PostgreSQL (Internal for Render, External for Replit)

## Fixed Issues
- **ChunkLoadError**: Resolved by clearing `.next` and rebuilding.
- **Prisma v7 Config**: Moved `DATABASE_URL` to `prisma.config.ts` as required by Prisma 7 for WASM/Next.js compatibility.
- **Railway/Vercel**: All remnants removed.

## Deployment
1. Push code to GitHub.
2. Render auto-deploys based on `render.yaml`.
