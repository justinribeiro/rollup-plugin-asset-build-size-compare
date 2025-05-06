[![npm version](https://badge.fury.io/js/@justinribeiro%2Frollup-plugin-asset-build-size-compare.svg)](https://badge.fury.io/js/@justinribeiro%2Frollup-plugin-asset-build-size-compare)

# rollup-plugin-asset-build-size-compare

> Track asset build sizes and compare over time with Rollup. A opinionated and modified version of Wes's [rollup-plugin-size](https://github.com/luwes/rollup-plugin-size), which was the rollup port of Jason's webpack [size-plugin](https://github.com/GoogleChromeLabs/size-plugin)

## Features

- Allows tracking build asset sizes, in either gzip, brotli, or no compression at all (don't ship your stuff that way!)
- Sets more sane compression defaults based on
- Allows setting custom compression targets to better match your web server compression settings
- Writes a file to disk for easy tracking of size over time (e.g., .rollup-plugin-asset-build-size-compare-data-${options.compression}.json)
- Color codes asset file sizes in out (red > 75kB, yellow > 40kB, cyan > 20kB, green < 20kB) to remind you that performance matters (and you should care)

## Installation

Install `justinribeiro@/rollup-plugin-asset-build-size-compare` as a development dependency using npm:

```sh
npm i -D justinribeiro@/rollup-plugin-asset-build-size-compare
```

## Quick Start

Add the plugin to your rollup configuration:

```diff
// rollup.config.js
+ import size from 'rollup-plugin-asset-build-size-compare';

plugins: [
+   size()
]
```

For first time run, you'll get and initial set of sizes:

![An initial run of the plugin](https://github.com/user-attachments/assets/f451032b-b3a7-4af3-b19b-b8c81afa5df5)

For additional runs, you'll get the change in those sizes (or no change in the example case as we did not edit anything):

![A second run, showing no change in size](https://github.com/user-attachments/assets/79299735-d3c5-49f9-8f6d-9f8193fc7aef)

## Options

You can set various options within the plugin.
```
size({
  compression: 'brotli',
  compressionLevel: 6,
  pattern: '**/*.{mjs,js,jsx,css,html}',
  exclude: 'vendor/**',
  filename: '.rollup-plugin-asset-build-size-compare-data-brotli.json',
  writeFile: true,
  columnWidth: 20,
});
```

| Option                   | Description                                                                                        | Default                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `compression`            | The compression algorithm to run on the build assets. One of `'none'`, `'gzip'`, or `'brotli'`.    | `'gzip'`                                                                     |
| `compressionLevel`   | Compression level to use for gzip (range: 1–9) or brotli (range: 1–11)                                 | `6`                                                                          |
| `pattern`                | Minimatch pattern to include files from the build assets.                                          | `'**/*.{mjs,js,jsx,css,html}'`                                               |
| `exclude`                | Minimatch pattern to exclude files from the build assets.                                          | `undefined`                                                                  |
| `filename`               | The file name to write asset size data to disk. Supports template string `${options.compression}`. | `'.rollup-plugin-asset-build-size-compare-data-${options.compression}.json'` |
| `writeFile`              | Whether to write the asset size data file to disk.                                                 | `true`                                                                       |
| `columnWidth`            | The number of characters used for column width in console output.                                  | `20`                                                                         |


## License

[Apache 2.0](LICENSE)
