# Deployment

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`. The workflow runs on pushes to `main` and `master`, supports manual `workflow_dispatch`, builds the Vite app, uploads `dist`, and deploys with the official Pages action.
