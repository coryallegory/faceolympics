# Deployment

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`.

## Production deploys

The workflow builds the Vite app and deploys `dist` to the `gh-pages` branch when commits land on `main` or `master`. Manual `workflow_dispatch` runs use the same production deployment path.

Production URL: <https://coryallegory.github.io/faceolympics/>

## Pull request previews

The same workflow also runs for pull requests. Pull request builds deploy `dist` into the shared `pr/` folder on the `gh-pages` branch without cleaning the rest of the branch, so preview deploys do not touch the production root files.

PR preview URL: <https://coryallegory.github.io/faceolympics/pr/?v=CAL-VISIBLE-06>

The preview folder is intentionally shared across pull requests; whichever PR deploys most recently may replace the previous preview. It is acceptable for production deploys from `main` or `master` to wipe the preview folder.

Codex tasks that create a PR should finish with a cache-busted PR preview URL using the current visible calibration build code, for example `https://coryallegory.github.io/faceolympics/pr/?v=CAL-VISIBLE-06`, so reviewers can test the branch before merge without reusing a stale browser cache.


## Cache behavior

GitHub Pages does not let this repository set custom HTTP cache-control headers for preview files. The app includes HTML no-cache meta tags for future page loads, but reviewers should use the cache-busted PR preview URL with a changing `?v=` value when validating new calibration UI changes.
