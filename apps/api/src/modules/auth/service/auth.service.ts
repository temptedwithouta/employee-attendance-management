import type { User, UserRole } from '../model/entity/user';
import type { UserRepository } from '../repository/user.repository';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  employeeId: string | null;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
  }
}

export interface PasswordVerifier {
  verify(hash: string | null, password: string): Promise<boolean>;
}

export interface TokenSigner {
  sign(user: AuthenticatedUser): Promise<string>;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordVerifier,
    private readonly tokens: TokenSigner,
  ) {}

  private activeUser(user: User | null): AuthenticatedUser {
    if (
      !user ||
      (user.employeeId !== null && user.employeeStatus !== 'ACTIVE') ||
      (user.role === 'EMPLOYEE' && user.employeeId === null)
    ) {
      throw new InvalidCredentialsError();
    }
    return { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const account = await this.users.findByEmail(email);
    const validPassword = await this.passwords.verify(account?.passwordHash ?? null, password);
    if (!account || !validPassword) {
      throw new InvalidCredentialsError();
    }
    const user = this.activeUser(account);
    const accessToken = await this.tokens.sign(user);
    return { accessToken, user };
  }

  async currentUser(id: string): Promise<AuthenticatedUser> {
    return this.activeUser(await this.users.findById(id));
  }
}
