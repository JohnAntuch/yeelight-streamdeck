import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.local.yeelight.sdPlugin";

/** @type {import('rollup').RollupOptions} */
export default {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    sourcemap: isWatching
  },
  plugins: [
    {
      name: "watch-manifest",
      buildStart() {
        this.addWatchFile(`${sdPlugin}/manifest.json`);
      }
    },
    typescript(),
    nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
    commonjs(),
    !isWatching && terser(),
    {
      name: "emit-module-package-file",
      generateBundle() {
        this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
      }
    }
  ]
};
