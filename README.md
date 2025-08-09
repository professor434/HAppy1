# Shadcn-UI Template Usage Instructions

## technology stack

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

All shadcn/ui components have been downloaded under `@/components/ui`.

## File Structure

- `index.html` - HTML entry point
- `vite.config.ts` - Vite configuration file
- `tailwind.config.js` - Tailwind CSS configuration file
- `package.json` - NPM dependencies and scripts
- `src/app.tsx` - Root component of the project
- `src/main.tsx` - Project entry point
- `src/index.css` - Existing CSS configuration

## Components

- All shadcn/ui components are pre-downloaded and available at `@/components/ui`

## Styling

- Add global styles to `src/index.css` or create new CSS files as needed
- Use Tailwind classes for styling components

## Development

- Import components from `@/components/ui` in your React components
- Customize the UI by modifying the Tailwind configuration

## Note

The `@/` path alias points to the `src/` directory

# Commands

**Install Dependencies**

```shell
pnpm i
```

**Start Preview**

```shell
pnpm run dev
```

**To build**

```shell
pnpm run build
```

## Backend CORS configuration

The backend reads allowed origins from the `CORS_ORIGIN` environment variable.
Provide a comma‑separated list of origins or wildcard patterns. The character
`*` can be used to match any subdomain, and a lone `*` allows all origins. If
omitted, the server defaults to `http://localhost:5173` for development.

```bash
CORS_ORIGIN="https://*.example.com,http://localhost:5173"
node backend/server.js
```

For this project the variable is typically set to:

```bash
CORS_ORIGIN="https://happypennisofficialpresale.vercel.app,https://happypennisofficialpresale-e1syb8uhk-proffesorsafas-projects.vercel.app,http://localhost:5173"
```

### Mobile/iOS deployments

When running inside a mobile WebView (e.g. iOS with Capacitor), include the
scheme used by the app:

```bash
CORS_ORIGIN="capacitor://localhost,https://*.example.com"
```

This permits requests from the mobile application alongside web domains.
