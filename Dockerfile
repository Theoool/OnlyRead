# ============================================
# Multi-stage Dockerfile for Next.js
# ============================================

# Stage 1: Dependencies
# Using AWS Public ECR mirror for better connectivity
FROM public.ecr.aws/docker/library/node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Copy Prisma schema (required for postinstall script 'prisma generate')
COPY prisma ./prisma

# Install dependencies
# We need to install dev dependencies as well because 'prisma generate' (in postinstall) needs 'prisma' CLI which is a dev dependency
RUN pnpm install && pnpm store prune

# Stage 2: Builder
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dummy environment variables to bypass Prisma validation during build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy"
# Set dummy OPENAI_API_KEY to bypass build-time validation in API routes
ENV OPENAI_API_KEY="dummy-key-for-build"

# Install all dependencies (including devDependencies) for build
# We explicitly install dotenv to ensure it is available for prisma.config.ts
RUN pnpm install && pnpm add -D dotenv

# Generate Prisma Client
RUN pnpm prisma generate

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
RUN pnpm run build

# Stage 3: Runner
FROM public.ecr.aws/docker/library/node:20-alpine AS runner
# Install libc6-compat for Next.js/Prisma in runtime
RUN apk add --no-cache libc6-compat
# Install pnpm and prisma globally for database management
RUN npm install -g pnpm prisma@6.19.2

# Remove prisma.config.ts if it exists to prevent config loading issues in production
# and fallback to standard schema.prisma behavior
RUN rm -f prisma.config.ts

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib/generated ./lib/generated

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
