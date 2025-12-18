// Type declarations for markdown file imports with ?raw query parameter
declare module '*.md?raw' {
  const content: string;
  export default content;
}
