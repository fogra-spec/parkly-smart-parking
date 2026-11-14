const {getDefaultConfig}=require('expo/metro-config');
const path=require('node:path');
const config=getDefaultConfig(__dirname);
// Isolated nested project: share only the website's dependency-free domain files.
// Keep native React resolution inside mobile rather than the website's React tree.
config.watchFolders=[path.resolve(__dirname,'..')];
config.resolver.nodeModulesPaths=[path.resolve(__dirname,'node_modules')];
// Keep pnpm's transitive dependency links resolvable. Shared imports are pure TS.
module.exports=config;
