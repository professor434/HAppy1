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

## API Base URL

The frontend reads the `VITE_API_BASE_URL` environment variable to know where to send API requests. It defaults to `/api`.

When running the backend directly (without serving it behind `/api`), set this variable to the backend's full URL to prevent 404 errors on endpoints like `/status` or `/can-claim`.

## Production redirect URL

When a wallet connects inside a mobile in-app browser, the page redirects to `VITE_PROD_URL`. Set this variable in your `.env` files to control the destination URL. It defaults to the official presale site.

Create a `.env.local` file with:

```
VITE_API_BASE_URL=http://localhost:8080
```

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
