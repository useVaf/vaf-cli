import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

export function error(message: string): void {
  console.error(chalk.red('✖ Error:'), message);
}

export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

export function warn(message: string): void {
  console.warn(chalk.yellow('⚠'), message);
}

export function prettyJson(obj: any): void {
  console.log(JSON.stringify(obj, null, 2));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

export async function zipDirectory(
  dirPath: string,
  outputPath: string,
  ignorePatterns?: string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);

    // Add .vafignore patterns if provided
    if (ignorePatterns && ignorePatterns.length > 0) {
      archive.glob('**/*', {
        cwd: dirPath,
        ignore: ignorePatterns,
      });
    } else {
      archive.directory(dirPath, false);
    }

    archive.finalize();
  });
}

export async function readVafIgnore(dirPath: string): Promise<string[]> {
  const ignoreFile = path.join(dirPath, '.vafignore');
  if (!fs.existsSync(ignoreFile)) {
    return ['node_modules/**', '.git/**', '*.log', '.env', '.DS_Store'];
  }

  const content = fs.readFileSync(ignoreFile, 'utf-8');
  const patterns = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  return patterns;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

