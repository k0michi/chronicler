#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
import * as util from 'util';
import * as childProcess from 'child_process';
import arg from 'arg';

const execFile = util.promisify(childProcess.execFile);

const args = arg({
  '--suffix': Boolean,
  '-s': '--suffix',
  '--time': Boolean,
  '-t': '--time',
  '--gzip': Boolean,
  '--bzip2': Boolean,
  '--xz': Boolean,
  '--zstd': Boolean
});

const date = new Date();
const command = args._[0];

const dateExp = /_?(\d{4})-(\d{2})-(\d{2})(_(\d{2})\.(\d{2})\.(\d{2}))?_?/g;

if (command == 'create') {
  const [extname, basename] = splitFilename(args._[1] ?? '');
  const filename = createFilename(date, basename, extname, args['--suffix'], args['--time']);

  try {
    await fs.open(filename, 'r');
    console.log(`File ${filename} already exists.`);
  } catch (e) {
    await fs.open(filename, 'a');
    console.log(`File ${filename} has been created.`);
  }
} else if (command == 'touch') {
  const oldFilename = args._[1];
  const dateRes = dateExp.exec(oldFilename);

  if (dateRes != null) {
    const start = dateRes.index;
    const end = dateRes.index + dateRes[0].length;
    const originalName = oldFilename.substring(0, start) + oldFilename.substring(end);
    const [extname, basename] = splitFilename(originalName);
    const newFilename = createFilename(date, basename, extname, args['--suffix'], args['--time']);
    await fs.rename(oldFilename, newFilename);
    console.log(`File ${oldFilename} has been renamed ${newFilename}.`);
  } else {
    const [extname, basename] = splitFilename(oldFilename);
    const newFilename = createFilename(date, basename, extname, args['--suffix'], args['--time']);
    await fs.rename(oldFilename, newFilename);
    console.log(`File ${oldFilename} has been renamed ${newFilename}.`);
  }
} else if (command == 'archive') {
  const compressExt = getCompressExt();
  const src = args._[1];
  const dir = await isDirectory(src);

  if (dir) {
    let dest = createFilename(date, src, '.tar', args['--suffix'], args['--time']);

    if (compressExt != null) {
      const compressOption = getCompressOption();
      await execFile('tar', [compressOption, '-cf', dest + compressExt, src]);
      console.log(`Archive ${dest + compressExt} has been created.`);
    } else {
      await execFile('tar', ['-cf', dest, src]);
      console.log(`Archive ${dest} has been created.`);
    }
  } else {
    const [extname, basename] = splitFilename(args._[1]);
    let dest = createFilename(date, basename, extname, args['--suffix'], args['--time']);

    if (compressExt != null) {
      const compressCommand = getCompressCommand();
      await execFile(compressCommand, ['-k', src]);
      await fs.rename(src + compressExt, dest + compressExt);
      console.log(`Archive ${dest + compressExt} has been created.`);
    } else {
      await fs.copyFile(src, dest);
      console.log(`Archive ${dest} has been created.`);
    }
  }
}

function getCompressOption() {
  if (args['--gzip']) {
    return '--gzip';
  } else if (args['--bzip2']) {
    return '--bzip2';
  } else if (args['--xz']) {
    return '--xz';
  } else if (args['--zstd']) {
    return '--zstd';
  }
}

function getCompressExt() {
  if (args['--gzip']) {
    return '.gz';
  } else if (args['--bzip2']) {
    return '.bz2';
  } else if (args['--xz']) {
    return '.xz';
  } else if (args['--zstd']) {
    return '.zst';
  }
}

function getCompressCommand() {
  if (args['--gzip']) {
    return 'gzip';
  } else if (args['--bzip2']) {
    return 'bzip2';
  } else if (args['--xz']) {
    return 'xz';
  } else if (args['--zstd']) {
    return 'zstd';
  }
}

async function isDirectory(path) {
  const stats = await fs.stat(path);
  return stats.isDirectory();
}

function splitFilename(name) {
  if (name.startsWith('.')) {
    return [name, ''];
  }

  const extname = path.extname(name);
  const basename = path.basename(name, extname);
  return [extname, basename];
}

function padZero(string, length) {
  return string.padStart(length, '0');
}

function dateToString(date) {
  return `${padZero(date.getFullYear().toString(), 4)}-${padZero((date.getMonth() + 1).toString(), 2)}-${padZero(date.getDate().toString(), 2)}`;
}

function timeToString(date) {
  return `${padZero(date.getHours().toString(), 2)}.${padZero(date.getMinutes().toString(), 2)}.${padZero(date.getSeconds().toString(), 2)}`;
}

function createFilename(date, name, extension, isSuffix, appendTime) {
  let dateString = dateToString(date);

  if (appendTime) {
    dateString += '_' + timeToString(date);
  }

  let filename = '';

  if (name.length > 0) {
    if (isSuffix) {
      filename += `${name}_${dateString}`;
    } else {
      filename += `${dateString}_${name}`;
    }
  } else {
    filename += dateString;
  }

  return filename + extension;
}