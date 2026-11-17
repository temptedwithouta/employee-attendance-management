import { Logger } from '@nestjs/common';
import { mkdtemp, open, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalPhotoStorage } from './local-photo.storage';

jest.mock('node:fs/promises', () => ({
  ...jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises'),
  open: jest.fn(),
  unlink: jest.fn(),
}));

it('attempts to remove an incomplete photo even when closing its handle fails', async () => {
  const actual = jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises');
  const directory = await mkdtemp(join(tmpdir(), 'dexa-storage-test-'));
  const filePath = join(directory, 'handle');
  const handle = await actual.open(filePath, 'wx');
  jest.mocked(open).mockResolvedValueOnce(handle);
  jest.mocked(unlink).mockResolvedValueOnce(undefined);
  jest.spyOn(handle, 'writeFile').mockRejectedValueOnce(new Error('write failed'));
  jest.spyOn(handle, 'close').mockRejectedValueOnce(new Error('close failed'));
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  try {
    await expect(
      new LocalPhotoStorage(directory).save(Buffer.from('photo'), 'png'),
    ).rejects.toThrow();
    expect(unlink).toHaveBeenCalledTimes(1);
  } finally {
    jest.restoreAllMocks();
    await handle.close();
    await actual.unlink(filePath);
    await rmdir(directory);
  }
});
