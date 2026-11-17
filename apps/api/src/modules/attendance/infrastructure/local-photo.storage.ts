import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { PhotoStorage } from '../service/attendance.service';

export class LocalPhotoStorage implements PhotoStorage {
  private readonly directory: string;
  private readonly logger = new Logger(LocalPhotoStorage.name);

  constructor(directory: string) {
    this.directory = isAbsolute(directory)
      ? directory
      : resolve(__dirname, '../../../../', directory);
  }

  private path(key: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg)$/.test(key)
    ) {
      throw new Error('Invalid photo storage key');
    }
    return join(this.directory, key);
  }

  async save(data: Buffer, extension: 'png' | 'jpg'): Promise<string> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const key = `${randomUUID()}.${extension}`;
    const file = await open(this.path(key), 'wx', 0o600);
    try {
      await file.writeFile(data);
      await file.close();
    } catch (error) {
      const cleanupErrors: unknown[] = [];
      try {
        await file.close();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      try {
        await this.remove(key);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      if (cleanupErrors.length > 0) {
        this.logger.error('Failed to clean up incomplete attendance photo');
        throw new AggregateError(
          [error, ...cleanupErrors],
          'Failed to clean up incomplete attendance photo',
        );
      }
      throw error;
    }
    return key;
  }

  async read(key: string): Promise<{ data: Buffer; contentType: string }> {
    const data = await readFile(this.path(key));
    return { data, contentType: key.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.path(key));
    } catch (error) {
      this.logger.error('Failed to remove attendance photo');
      throw error;
    }
  }
}
