[![npm version](https://badge.fury.io/js/@justinribeiro%2Frollup-plugin-asset-build-size-compare.svg)](https://badge.fury.io/js/@justinribeiro%2Frollup-plugin-asset-build-size-compare)

# \rollup-plugin-asset-build-size-compare

> Track asset build sizes and compare over time with Rollup. A opinionated and modified version of Wes's [rollup-plugin-size](https://github.com/luwes/rollup-plugin-size), which was the rollup port of Jason's webpack [size-plugin](https://github.com/GoogleChromeLabs/size-plugin)

## Features

- Allows tracking build asset sizes, in either gzip, brotli, or no compression at all (don't ship your stuff that way!)
- Writes a file to disk for easy tracking of size over time (e.g., .rollup-plugin-asset-build-size-compare-data-${options.compression}.json)
- Color codes asset file sizes in out (red > 75kB, yellow > 40kB, cyan > 20kB, green < 20kB) to remind you that performance matters (and you should care)

## Installation

Install `justinribeiro@/rollup-plugin-asset-build-size-compare` as a development dependency using npm:

```sh
npm i -D justinribeiro@/rollup-plugin-asset-build-size-compare
```

## Usage

Add the plugin to your rollup configuration:

```diff
// rollup.config.js
+ import size from 'rollup-plugin-asset-build-size-compare';

plugins: [
+   size()
]
```

For first time run, you'll get and initial set of sizes:

![An initial run of the plugin](https://github.com/user-attachments/assets/eae29e3b-8300-45ab-87f7-d6796fcee563)

For second runs, you'll get the change in those sizes:

![A second run, showing no change in size](https://github.com/user-attachments/assets/e8cf29bd-656b-4667-ac68-d1b1d8f73ca9)

## Options

You can set various options within the plugin.
```
size({
  compression: 'brotli',
  pattern: '**/*.{mjs,js,jsx,css,html}',
  exclude: undefined,
  writeFile: true,
});
```

| Name           | Description                                                      | Default |
| -------------- | ---------------------------------------------------------------- | ------- |
| `compression`  | The compression to run on the build assets ('none' | 'gzip' | 'brotli') | `gzip`|
| `pattern`      | The minimatch pattern of files within the build assets you want to track | `**/*.{mjs,js,jsx,css,html}` |
| `exclude`      | The minimatch pattern of files within the build assets you DO NOT want to track | `undefined` |
| `filename`    | The file name to save build asset file sizes to disk  | `.rollup-plugin-asset-build-size-compare-data-${options.compression}.json` |
| `writeFile` | Whether to write the build asset files sizes to disk. | `true` |

## License

[Apache 2.0](LICENSE)
