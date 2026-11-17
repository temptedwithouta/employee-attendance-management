import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import type { PasswordVerifier } from '../service/auth.service';

@Injectable()
export class Argon2PasswordVerifier implements PasswordVerifier, OnModuleInit {
  private dummyHash!: string;

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(randomBytes(32), { type: argon2.argon2id });
  }

  verify(hash: string | null, password: string): Promise<boolean> {
    return argon2.verify(hash ?? this.dummyHash, password);
  }
}
