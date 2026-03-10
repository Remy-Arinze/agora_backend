import * as path from 'path';
import { BadRequestException } from '@nestjs/common';

/**
 * Safely resolves a file path within a base directory to prevent path traversal attacks.
 * @param baseDir The root directory where files should be stored (e.g., 'uploads')
 * @param relativePath The path to the file relative to the baseDir or an absolute path to check
 * @returns The resolved absolute path
 * @throws BadRequestException if the resolved path is outside the base directory
 */
export function safeResolvePath(baseDir: string, relativePath: string): string {
    const absoluteBase = path.resolve(baseDir);
    const resolvedPath = path.resolve(relativePath);

    if (!resolvedPath.startsWith(absoluteBase)) {
        throw new BadRequestException('Invalid file path: path traversal detected');
    }

    return resolvedPath;
}
