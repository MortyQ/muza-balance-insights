// electron-vite: `import p from './x.ts?modulePath'` builds x.ts as its own entry and gives its output path.
declare module '*?modulePath' {
  const path: string;
  export default path;
}
