import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

function deriveKey(
  password: string,
  salt: string,
  keyLength: number,
  cost = SCRYPT_COST,
  blockSize = SCRYPT_BLOCK_SIZE,
  parallelization = SCRYPT_PARALLELIZATION,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

@Injectable()
export class AuthPasswordService {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('base64url');
    const derivedKey = await deriveKey(password, salt, KEY_LENGTH);

    return [
      'scrypt',
      SCRYPT_COST,
      SCRYPT_BLOCK_SIZE,
      SCRYPT_PARALLELIZATION,
      salt,
      derivedKey.toString('base64url'),
    ].join('$');
  }

  async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    const parts = passwordHash.split('$');

    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }

    const [, cost, blockSize, parallelization, salt, storedKey] = parts;
    const storedKeyBuffer = Buffer.from(storedKey, 'base64url');
    const derivedKey = await deriveKey(
      password,
      salt,
      storedKeyBuffer.length,
      Number(cost),
      Number(blockSize),
      Number(parallelization),
    );

    return (
      storedKeyBuffer.length === derivedKey.length &&
      timingSafeEqual(storedKeyBuffer, derivedKey)
    );
  }
}
