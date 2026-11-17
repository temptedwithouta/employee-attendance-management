import * as argon2 from 'argon2';
import { Argon2PasswordVerifier } from '../infrastructure/argon2-password-verifier';
import { AuthService } from './auth.service';
import type { UserRepository } from '../repository/user.repository';

jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn().mockResolvedValue('dummy-hash'),
  verify: jest.fn().mockResolvedValue(false),
}));

it('performs password verification for an unknown account', async () => {
  const users: UserRepository = {
    findByEmail: async () => null,
    findById: async () => null,
  };
  const passwords = new Argon2PasswordVerifier();
  await passwords.onModuleInit();
  const auth = new AuthService(users, passwords, { sign: async () => 'unused' });
  await expect(auth.login('unknown@example.test', 'wrong-password')).rejects.toThrow(
    'Invalid credentials',
  );
  expect(argon2.verify).toHaveBeenCalledWith('dummy-hash', 'wrong-password');
});
