<div align="center">
  <h1>🌵<br>React Portfolio</h1>
  <h3>Portfolio One-Pager made with ReactJs</h3>
  <h3><a href="https://patricksmith.io/" target="_blank">Live Preview</a></h3>
</div>

<div align="center"><img src="https://user-images.githubusercontent.com/29565530/144163917-196b3e87-90e2-4615-b1c7-6a905533f34b.gif" /></div>
<div align="center">
  <p>Home background effect made with React-Particles</p>
</div>

<br>

## 💬 Overview:

A simple one-page react portfolio with clearly defined and modular components which can be easily swapped in and out depending on your use-case. Currently integrated with Apollo & Github API to call repositories with a user provided auth token.

## 🛠️ Packages & APIs

- [React](https://reactjs.org/)
- [particles.js](https://github.com/VincentGarreau/particles.js/)
- [react-reveal](https://github.com/rnosov/react-reveal)
- [react-is-visible](https://github.com/lessp/react-is-visible)

## Local development

Use Node 22, matching CI. With [nvm](https://github.com/nvm-sh/nvm), the committed `.nvmrc` selects
the correct major version:

```bash
nvm use
npm ci
npm run dev
```

Create a production build with `npm run build` and serve it locally with `npm run preview`.

## Development checks

Pull requests and pushes to `main` install the committed lockfile with Node 22, then run the same
quality gate expected locally:

```bash
npm run lint && npm run format:check && npm run build
```

The lint and formatting scripts currently check JavaScript, JSX, CSS, JSON, and Markdown files under
`src` only. Check other changed files separately.
