// @ts-check
import path from 'path';
import chalk from 'chalk';
import { promisify } from 'node:util';
import globPromise from 'glob';
import minimatch from 'minimatch';
import zlib from 'node:zlib';
import prettyBytes from 'pretty-bytes';
import fs from 'fs-extra';
const glob = promisify(globPromise);

/**
 * @typedef {import('rollup').OutputOptions} OutputOptions
 * @typedef {import('rollup').OutputBundle} OutputBundle
 */

/**
 * @typedef {Object} AssetBuildSizeCompareOptions
 * @property {'none' | 'gzip' | 'brotli'} compression - The compression
 * algorithm to run on the build assets. Default: `'gzip'`.
 * @property {number} compressionLevel - Compression level; gzip (1–9) or brotli
 * (1-11). Default: `6`.
 * @property {string} pattern - Minimatch pattern of files to include from the
 * build assets. Default: `'{mjs,js,jsx,css,html}'`.
 * @property {string} exclude - Minimatch pattern of files to exclude from the
 * build assets.
 * @property {string} filename - Filename to save build asset sizes to disk.
 * Default:
 * `'.rollup-plugin-asset-build-size-compare-data-${options.compression}.json'`.
 * @property {boolean} writeFile - Whether to write build asset sizes to disk.
 * Default: `true`.
 * @property {number} columnWidth - Character width for console output
 * formatting. Default: `20`.
 */

/**
 * A collection of utility functions for working with arrays and file data.
 */
const __utils = {
  /**
   * Converts two parallel arrays (names and values) into an object map.
   *
   * @param {string[]} names - The array of keys.
   * @param {any[]} values - The array of values corresponding to each key.
   * @returns {{ [key: string]: any }} An object mapping each name to its
   * corresponding value.
   */
  toMap: (names, values) => {
    return names.reduce((map, name, i) => {
      map[name] = values[i];
      return map;
    }, {});
  },

  /**
   * Returns true if the item is the first occurrence in the array (used for
   * filtering duplicates).
   *
   * @param {any} item - The current item.
   * @param {number} index - The current index.
   * @param {any[]} arr - The full array.
   * @returns {boolean} True if the item is not a duplicate, otherwise false.
   */
  dedupe: (item, index, arr) => {
    return arr.indexOf(item) === index;
  },

  /**
   * Converts an array of file objects into a map of filenames to file sizes,
   * excluding zero-size files.
   *
   * @param {{ filename: string, size: number }[]} files - The array of file
   * objects.
   * @returns {{ [filename: string]: number }} An object mapping filenames to
   * their sizes.
   */
  toFileMap: (files) => {
    return files.reduce((result, file) => {
      if (file.size) {
        // exclude zero-size files
        result[file.filename] = file.size;
      }
      return result;
    }, {});
  },
};

/**
 * Asset Build Size Plugin for Rollup
 * @param {AssetBuildSizeCompareOptions} [args] - Configuration options for asset
 * size comparison.
 * @returns {{ name: string, generateBundle: (outputOptions:
 *   OutputOptions, bundle: OutputBundle) =>
 *   Promise<void> }} Plugin object with Rollup lifecycle hooks.
 */
function bundleSize(args) {
  /** @type {AssetBuildSizeCompareOptions} */
  const __defaultOptions = {
    compression: 'gzip',
    /**
     * Gzip Range 1 - 9; Brief study of data (N = 970) from GitHub NGINX setting
     * show Mode at 6
     * Brotli Range 1 - 11; zlib.constants.BROTLI_DEFAULT_QUALITY
     * is defined as 6; brief study of data (N = 784) from GitHub NGINX setting
     * show Mode at 6; Android also sets this as the default 6 in init if
     * undefined kBrotliDefaultQuality
     */
    compressionLevel: 6,
    pattern: '**/*.{mjs,js,jsx,css,html}',
    exclude: '',
    filename: '',
    writeFile: true,
    columnWidth: 20,
  };

  const options = { ...__defaultOptions, ...args };
  let { pattern, exclude, compression } = options;

  // always overwrite this from the default options to get it right even if
  // no filename is defined
  options.filename =
    options.filename ||
    `.rollup-plugin-asset-build-size-compare-data-${options.compression}.json`;

  // generate a path for later use as this is inner scope
  const filename = path.join(process.cwd(), options.filename);

  let initialSizes;
  let isSingleChunk;

  /**
   * Capture initial file sizes before writing output bundle.
   * @param {OutputOptions} outputOptions
   * @param {OutputBundle} bundle
   */
  async function generateBundle(outputOptions, bundle) {
    const _path = outputOptions.dir
      ? path.resolve(outputOptions.dir)
      : path.dirname(outputOptions.file);

    let chunks = Object.values(bundle).filter(
      (outputFile) => outputFile.type === 'chunk',
    );
    isSingleChunk = chunks.length === 1;
    if (isSingleChunk) {
      pattern = chunks[0].fileName;
    }

    initialSizes = await load(_path);
    outputSizes(bundle).catch(console.error);
  }

  /**
   * Load existing asset build size data from disk or scan current build sizes
   * @param {string} outputPath - Output directory
   * @returns {Promise<Record<string, number>>} Map of file sizes
   */
  async function load(outputPath) {
    const data = await readFromDisk(filename);
    if (data.length) {
      const [{ files }] = data;
      return __utils.toFileMap(files);
    }
    return getSizes(outputPath);
  }

  /**
   * Read asset build data from our ASBC JSON file
   * @param {string} filename - ASBC JSON file path
   * @returns {Promise<Array<{ timestamp: number, files: any[] }>>}
   */
  async function readFromDisk(filename) {
    try {
      if (!options.writeFile) {
        return [];
      }
      const oldStats = await fs.readJSON(filename);
      return oldStats.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      return [];
    }
  }

  /**
   * Get ASBC data for matched asset files
   * @param {string} cwd - Current working directory to search for files
   * @returns {Promise<Record<string, number|null>>}
   */
  async function getSizes(cwd) {
    const files = await glob(pattern, { cwd, ignore: exclude });

    const sizes = await Promise.all(
      filterFiles(files).map(async (file) => {
        const source = await fs.promises
          .readFile(path.join(cwd, file))
          .catch(() => null);
        if (source == null) return null;
        return getCompressedSize(source);
      }),
    );

    return __utils.toMap(files, sizes);
  }

  /**
   * Compress a file buffer and return its size using the chosen compression
   * @param {Buffer} source - File contents
   * @returns {Promise<number>} Compressed byte length
   */
  async function getCompressedSize(source) {
    let compressed = source;
    if (compression === 'gzip') {
      const gz = promisify(zlib.gzip);
      compressed = await gz(source, {
        level: options.compressionLevel,
      });
    } else if (compression === 'brotli') {
      if (!zlib.brotliCompress)
        throw Error('Brotli not supported in this Node version.');
      const br = promisify(zlib.brotliCompress);
      compressed = await br(source, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: options.compressionLevel,
        },
      });
    }
    return Buffer.byteLength(compressed);
  }

  /**
   * Filter asset filenames using include/exclude patterns
   * @param {string[]} files - List of file paths
   * @returns {string[]} Filtered file paths
   */
  function filterFiles(files) {
    const isMatched = minimatch.filter(pattern);
    const isExcluded = exclude ? minimatch.filter(exclude) : () => false;
    return files.filter((file) => isMatched(file) && !isExcluded(file));
  }

  /**
   * Write ABSC to disk if any file sizes changed
   * @param {string} filename - File path to write our SON
   * @param {{ timestamp: number, files: any[] }} stats - File compression data
   * @returns {Promise<void>}
   */
  async function writeToDisk(filename, stats) {
    if (stats.files.some((file) => file.diff !== 0)) {
      const data = await readFromDisk(filename);
      data.unshift(stats);
      if (options.writeFile) {
        await fs.ensureFile(filename);
        await fs.writeJSON(filename, data);
      }
    }
  }

  /**
   * Save ABSC data for comparison later
   * @param {Array<{ name: string, sizeBefore: number, size: number }>} files
   * @returns {Promise<void>}
   */
  async function save(files) {
    const stats = {
      timestamp: Date.now(),
      compressionType: options.compression,
      compressionLevel: options.compressionLevel,
      files: files.map((file) => ({
        filename: file.name,
        previous: file.sizeBefore,
        size: file.size,
        diff: file.size - file.sizeBefore,
      })),
    };
    options.save && (await options.save(stats));
    await writeToDisk(filename, stats);
  }

  /**
   * Compare sizes before/after and print formatted output
   * @param {OutputBundle} assets
   * @returns {Promise<void>}
   */
  async function outputSizes(assets) {
    const sizesBefore = await Promise.resolve(initialSizes);
    const assetNames = filterFiles(Object.keys(assets));
    const sizes = await Promise.all(
      assetNames.map((name) => getCompressedSize(assets[name].code)),
    );

    // map of de-hashed filenames to their final size
    const sizesAfter = __utils.toMap(assetNames, sizes);

    // get a list of unique filenames
    const files = [
      ...Object.keys(sizesBefore),
      ...Object.keys(sizesAfter),
    ].filter(__utils.dedupe);

    const width = Math.max(
      ...files.map((file) => file.length),
      options.columnWidth || 0,
    );
    let output = '';
    const items = [];

    for (const name of files) {
      const size = sizesAfter[name] || 0;
      const sizeBefore = sizesBefore[name] || 0;
      const delta = size - sizeBefore;
      const msg = new Array(width - name.length + 2).join(' ') + name + ' ⏤  ';
      const color =
        size > 75 * 1024
          ? 'red'
          : size > 40 * 1024
            ? 'yellow'
            : size > 20 * 1024
              ? 'cyan'
              : 'green';
      let sizeText = chalk[color](prettyBytes(size));
      let deltaText = '';
      if (delta && Math.abs(delta) > 1) {
        deltaText = (delta > 0 ? '+' : '') + prettyBytes(delta);
        if (delta > 1024) {
          sizeText = chalk.bold(sizeText);
          deltaText = chalk.red(deltaText);
        } else if (delta < -10) {
          deltaText = chalk.green(deltaText);
        }
        sizeText += ` (${deltaText})`;
      } else {
        sizeText += ` (no change)`;
      }
      const text = msg + sizeText + '\n';
      const item = {
        name,
        sizeBefore,
        size,
        sizeText,
        delta,
        deltaText,
        msg,
        color,
      };
      items.push(item);

      output += text;
    }

    await save(items);

    if (output) {
      if (isSingleChunk) {
        // Remove newline for single file output.
        output = output.trimEnd();
      }
      console.log(
        `Measured Delta in Asset Build Size - (using ${options.compression}_comp_level: ${options.compressionLevel})`,
      );
      console.log(output);
    }
  }

  return {
    name: 'rollup-plugin-asset-build-size-compare',
    generateBundle,
  };
}

export default bundleSize;
