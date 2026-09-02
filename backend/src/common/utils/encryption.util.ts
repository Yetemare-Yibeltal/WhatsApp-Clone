// backend/src/common/utils/encryption.util.ts
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";
import { createHash } from "crypto";
import { Logger } from "@nestjs/common";
import { promisify } from "util";
import { randomBytes, randomInt } from "crypto";
import { pipeline } from "stream";
import { createReadStream, createWriteStream } from "fs";

// -------- CONSTANTS --------
export const ENCRYPTION = {
  AES_256_GCM: "aes-256-gcm",
  AES_256_CBC: "aes-256-cbc",
  AES_192_GCM: "aes-192-gcm",
  AES_128_GCM: "aes-128-gcm",
  CHACHA20_POLY1305: "chacha20-poly1305",
};

export const HASH = {
  SHA256: "sha256",
  SHA384: "sha384",
  SHA512: "sha512",
  MD5: "md5",
  SHA1: "sha1",
};

export const KEY_DERIVATION = {
  PBKDF2: "pbkdf2",
  ARGON2ID: "argon2id",
  SCRYPT: "scrypt",
};

export const ENCODING = {
  BASE64: "base64",
  BASE64URL: "base64url",
  HEX: "hex",
  UTF8: "utf8",
  ASCII: "ascii",
};

export const DEFAULT = {
  ENCRYPTION_ALGORITHM: ENCRYPTION.AES_256_GCM,
  HASH_ALGORITHM: HASH.SHA256,
  KEY_DERIVATION_ALGORITHM: KEY_DERIVATION.PBKDF2,
  ENCODING: ENCODING.BASE64,
  SALT_LENGTH: 32,
  IV_LENGTH: 16,
  AUTH_TAG_LENGTH: 16,
  KEY_LENGTH: 32,
  BCRYPT_ROUNDS: 12,
  PBKDF2_ITERATIONS: 310000,
  PBKDF2_DIGEST: HASH.SHA256,
  ARGON2_ITERATIONS: 3,
  ARGON2_MEMORY: 65536,
  ARGON2_PARALLELISM: 4,
  TOKEN_LENGTH: 32,
  NONCE_LENGTH: 24,
};

// -------- TYPES --------
export interface EncryptionResult {
  encrypted: string; // base64 encoded encrypted data
  iv: string; // base64 encoded IV
  authTag?: string; // base64 encoded auth tag (for GCM)
  salt?: string; // base64 encoded salt (if derived)
  algorithm: string;
  encoding: string;
}

export interface DecryptionResult {
  decrypted: string;
  algorithm: string;
  encoding: string;
}

export interface KeyDerivationOptions {
  iterations?: number;
  digest?: string;
  memory?: number;
  parallelism?: number;
  hashLength?: number;
}

export interface EncryptFileOptions {
  algorithm?: string;
  encoding?: string;
  chunkSize?: number;
}

// -------- LOGGER --------
const logger = new Logger("EncryptionUtil");

// -------- ENCRYPTION UTILITY CLASS --------
export class EncryptionUtil {
  /**
   * Generate a secure random string.
   * @param length - Number of bytes
   * @param encoding - Output encoding
   * @returns Random string
   */
  static generateRandom(
    length: number = DEFAULT.TOKEN_LENGTH,
    encoding: string = ENCODING.BASE64,
  ): string {
    return randomBytes(length).toString(encoding);
  }

  /**
   * Generate a secure random number.
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (exclusive)
   * @returns Random integer
   */
  static generateRandomInt(min: number, max: number): number {
    return randomInt(min, max);
  }

  /**
   * Generate a secure UUID v4.
   * @returns UUID string
   */
  static generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate a secure nonce for encryption.
   * @param length - Nonce length in bytes
   * @returns Nonce buffer
   */
  static generateNonce(length: number = DEFAULT.NONCE_LENGTH): Buffer {
    return randomBytes(length);
  }

  /**
   * Generate a secure salt for key derivation.
   * @param length - Salt length in bytes
   * @returns Salt buffer
   */
  static generateSalt(length: number = DEFAULT.SALT_LENGTH): Buffer {
    return randomBytes(length);
  }

  /**
   * Derive a key from a password using PBKDF2.
   * @param password - Password string
   * @param salt - Salt buffer or string
   * @param keyLength - Key length in bytes
   * @param options - Key derivation options
   * @returns Derived key buffer
   */
  static deriveKeyPBKDF2(
    password: string,
    salt: Buffer | string,
    keyLength: number = DEFAULT.KEY_LENGTH,
    options: KeyDerivationOptions = {},
  ): Buffer {
    const iterations = options.iterations || DEFAULT.PBKDF2_ITERATIONS;
    const digest = options.digest || DEFAULT.PBKDF2_DIGEST;
    const saltBuffer =
      typeof salt === "string" ? Buffer.from(salt, ENCODING.BASE64) : salt;

    return crypto.pbkdf2Sync(
      password,
      saltBuffer,
      iterations,
      keyLength,
      digest,
    );
  }

  /**
   * Derive a key from a password using scrypt.
   * @param password - Password string
   * @param salt - Salt buffer or string
   * @param keyLength - Key length in bytes
   * @param options - Key derivation options
   * @returns Derived key buffer
   */
  static deriveKeyScrypt(
    password: string,
    salt: Buffer | string,
    keyLength: number = DEFAULT.KEY_LENGTH,
    options: KeyDerivationOptions = {},
  ): Buffer {
    const saltBuffer =
      typeof salt === "string" ? Buffer.from(salt, ENCODING.BASE64) : salt;
    const N = options.iterations || 16384;
    const r = options.parallelism || 8;
    const p = options.memory || 1;

    return crypto.scryptSync(password, saltBuffer, keyLength, { N, r, p });
  }

  /**
   * Derive a key from a password (auto-select best available).
   * @param password - Password string
   * @param salt - Salt buffer or string
   * @param keyLength - Key length in bytes
   * @param algorithm - Key derivation algorithm
   * @param options - Key derivation options
   * @returns Derived key buffer
   */
  static deriveKey(
    password: string,
    salt: Buffer | string,
    keyLength: number = DEFAULT.KEY_LENGTH,
    algorithm: string = KEY_DERIVATION.PBKDF2,
    options: KeyDerivationOptions = {},
  ): Buffer {
    switch (algorithm) {
      case KEY_DERIVATION.PBKDF2:
        return this.deriveKeyPBKDF2(password, salt, keyLength, options);
      case KEY_DERIVATION.SCRYPT:
        return this.deriveKeyScrypt(password, salt, keyLength, options);
      default:
        throw new Error(`Unsupported key derivation algorithm: ${algorithm}`);
    }
  }

  /**
   * Encrypt data using AES-256-GCM (authenticated encryption).
   * @param data - Data to encrypt (string or buffer)
   * @param key - Encryption key (buffer or string)
   * @param options - Encryption options
   * @returns Encryption result
   */
  static encryptAESGCM(
    data: string | Buffer,
    key: Buffer | string,
    options: Partial<EncryptionResult> = {},
  ): EncryptionResult {
    const algorithm = options.algorithm || DEFAULT.ENCRYPTION_ALGORITHM;
    const encoding = options.encoding || ENCODING.BASE64;
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.BASE64) : key;

    // Validate key length
    const keyLength = keyBuffer.length;
    if (keyLength !== 16 && keyLength !== 24 && keyLength !== 32) {
      throw new Error(
        `Invalid key length: ${keyLength}. Must be 16, 24, or 32 bytes.`,
      );
    }

    // Generate IV
    const iv = randomBytes(DEFAULT.IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);

    // Encrypt data
    const dataBuffer =
      typeof data === "string" ? Buffer.from(data, ENCODING.UTF8) : data;
    const encrypted = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final(),
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString(encoding),
      iv: iv.toString(encoding),
      authTag: authTag.toString(encoding),
      algorithm,
      encoding,
    };
  }

  /**
   * Decrypt data using AES-256-GCM (authenticated decryption).
   * @param encrypted - Encrypted data (base64 string)
   * @param key - Encryption key (buffer or string)
   * @param iv - IV (base64 string)
   * @param authTag - Authentication tag (base64 string)
   * @param options - Decryption options
   * @returns Decryption result
   */
  static decryptAESGCM(
    encrypted: string,
    key: Buffer | string,
    iv: string,
    authTag: string,
    options: Partial<DecryptionResult> = {},
  ): DecryptionResult {
    const algorithm = options.algorithm || DEFAULT.ENCRYPTION_ALGORITHM;
    const encoding = options.encoding || ENCODING.UTF8;
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.BASE64) : key;
    const ivBuffer = Buffer.from(iv, ENCODING.BASE64);
    const authTagBuffer = Buffer.from(authTag, ENCODING.BASE64);
    const encryptedBuffer = Buffer.from(encrypted, ENCODING.BASE64);

    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    return {
      decrypted: decrypted.toString(encoding),
      algorithm,
      encoding,
    };
  }

  /**
   * Encrypt data using AES-256-CBC (requires separate HMAC for authentication).
   * @param data - Data to encrypt
   * @param key - Encryption key (must be 32 bytes for AES-256)
   * @param options - Encryption options
   * @returns Encryption result
   */
  static encryptAESCBC(
    data: string | Buffer,
    key: Buffer | string,
    options: Partial<EncryptionResult> = {},
  ): EncryptionResult {
    const algorithm = options.algorithm || ENCRYPTION.AES_256_CBC;
    const encoding = options.encoding || ENCODING.BASE64;
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.BASE64) : key;

    // Validate key length
    if (keyBuffer.length !== 32) {
      throw new Error(
        `Invalid key length: ${keyBuffer.length}. Must be 32 bytes for AES-256-CBC.`,
      );
    }

    // Generate IV
    const iv = randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);

    // Encrypt data
    const dataBuffer =
      typeof data === "string" ? Buffer.from(data, ENCODING.UTF8) : data;
    const encrypted = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final(),
    ]);

    return {
      encrypted: encrypted.toString(encoding),
      iv: iv.toString(encoding),
      algorithm,
      encoding,
    };
  }

  /**
   * Decrypt data using AES-256-CBC.
   * @param encrypted - Encrypted data (base64 string)
   * @param key - Encryption key (buffer or string)
   * @param iv - IV (base64 string)
   * @param options - Decryption options
   * @returns Decryption result
   */
  static decryptAESCBC(
    encrypted: string,
    key: Buffer | string,
    iv: string,
    options: Partial<DecryptionResult> = {},
  ): DecryptionResult {
    const algorithm = options.algorithm || ENCRYPTION.AES_256_CBC;
    const encoding = options.encoding || ENCODING.UTF8;
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.BASE64) : key;
    const ivBuffer = Buffer.from(iv, ENCODING.BASE64);
    const encryptedBuffer = Buffer.from(encrypted, ENCODING.BASE64);

    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    return {
      decrypted: decrypted.toString(encoding),
      algorithm,
      encoding,
    };
  }

  /**
   * Encrypt data using ChaCha20-Poly1305 (authenticated encryption).
   * @param data - Data to encrypt
   * @param key - Encryption key
   * @param options - Encryption options
   * @returns Encryption result
   */
  static encryptChaCha20(
    data: string | Buffer,
    key: Buffer | string,
    options: Partial<EncryptionResult> = {},
  ): EncryptionResult {
    const algorithm = options.algorithm || ENCRYPTION.CHACHA20_POLY1305;
    const encoding = options.encoding || ENCODING.BASE64;
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.BASE64) : key;

    // Validate key length
    if (keyBuffer.length !== 32) {
      throw new Error(
        `Invalid key length: ${keyBuffer.length}. Must be 32 bytes for ChaCha20-Poly1305.`,
      );
    }

    // Generate nonce (96 bits for ChaCha20-Poly1305)
    const nonce = randomBytes(12);

    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, nonce);

    // Encrypt data
    const dataBuffer =
      typeof data === "string" ? Buffer.from(data, ENCODING.UTF8) : data;
    const encrypted = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final(),
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString(encoding),
      iv: nonce.toString(encoding),
      authTag: authTag.toString(encoding),
      algorithm,
      encoding,
    };
  }

  /**
   * Decrypt data using ChaCha20-Poly1305.
   * @param encrypted - Encrypted data (base64 string)
   * @param key - Encryption key
   * @param nonce - Nonce (base64 string)
   * @param authTag - Authentication tag (base64 string)
   * @param options - Decryption options
   * @returns Decryption result
   */
  static decryptChaCha20(
    encrypted: string,
    key: Buffer | string,
    nonce: string,
    authTag: string,
    options: Partial<DecryptionResult> = {},
  ): DecryptionResult {
    const algorithm = options.algorithm || ENCRYPTION.CHACHA20_POLY1305;
    const encoding = options.encoding || ENCODING.UTF8;
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.BASE64) : key;
    const nonceBuffer = Buffer.from(nonce, ENCODING.BASE64);
    const authTagBuffer = Buffer.from(authTag, ENCODING.BASE64);
    const encryptedBuffer = Buffer.from(encrypted, ENCODING.BASE64);

    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, nonceBuffer);
    decipher.setAuthTag(authTagBuffer);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    return {
      decrypted: decrypted.toString(encoding),
      algorithm,
      encoding,
    };
  }

  /**
   * Generic encryption function (auto-selects algorithm based on options).
   */
  static encrypt(
    data: string | Buffer,
    key: Buffer | string,
    options: Partial<EncryptionResult> = {},
  ): EncryptionResult {
    const algorithm = options.algorithm || DEFAULT.ENCRYPTION_ALGORITHM;

    switch (algorithm) {
      case ENCRYPTION.AES_256_GCM:
      case ENCRYPTION.AES_192_GCM:
      case ENCRYPTION.AES_128_GCM:
        return this.encryptAESGCM(data, key, options);
      case ENCRYPTION.AES_256_CBC:
        return this.encryptAESCBC(data, key, options);
      case ENCRYPTION.CHACHA20_POLY1305:
        return this.encryptChaCha20(data, key, options);
      default:
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
    }
  }

  /**
   * Generic decryption function.
   */
  static decrypt(
    encrypted: string,
    key: Buffer | string,
    iv: string,
    authTag: string,
    options: Partial<DecryptionResult> = {},
  ): DecryptionResult {
    const algorithm = options.algorithm || DEFAULT.ENCRYPTION_ALGORITHM;

    switch (algorithm) {
      case ENCRYPTION.AES_256_GCM:
      case ENCRYPTION.AES_192_GCM:
      case ENCRYPTION.AES_128_GCM:
        return this.decryptAESGCM(encrypted, key, iv, authTag, options);
      case ENCRYPTION.AES_256_CBC:
        return this.decryptAESCBC(encrypted, key, iv, options);
      case ENCRYPTION.CHACHA20_POLY1305:
        return this.decryptChaCha20(encrypted, key, iv, authTag, options);
      default:
        throw new Error(`Unsupported decryption algorithm: ${algorithm}`);
    }
  }

  /**
   * Encrypt data with a password (derives key from password).
   * @param data - Data to encrypt
   * @param password - Password string
   * @param options - Encryption options
   * @returns Encryption result with salt
   */
  static encryptWithPassword(
    data: string | Buffer,
    password: string,
    options: Partial<
      EncryptionResult & {
        saltLength?: number;
        keyDerivation?: string;
        keyDerivationOptions?: KeyDerivationOptions;
      }
    > = {},
  ): EncryptionResult & { salt: string } {
    const saltLength = options.saltLength || DEFAULT.SALT_LENGTH;
    const keyDerivation = options.keyDerivation || KEY_DERIVATION.PBKDF2;
    const keyLength = 32; // For AES-256

    // Generate salt
    const salt = this.generateSalt(saltLength);

    // Derive key from password
    const key = this.deriveKey(
      password,
      salt,
      keyLength,
      keyDerivation,
      options.keyDerivationOptions,
    );

    // Encrypt data
    const result = this.encrypt(data, key, options);

    return {
      ...result,
      salt: salt.toString(ENCODING.BASE64),
    };
  }

  /**
   * Decrypt data with a password.
   * @param encrypted - Encrypted data (base64 string)
   * @param password - Password string
   * @param iv - IV (base64 string)
   * @param authTag - Authentication tag (base64 string)
   * @param salt - Salt (base64 string)
   * @param options - Decryption options
   * @returns Decryption result
   */
  static decryptWithPassword(
    encrypted: string,
    password: string,
    iv: string,
    authTag: string,
    salt: string,
    options: Partial<
      DecryptionResult & {
        keyDerivation?: string;
        keyDerivationOptions?: KeyDerivationOptions;
        keyLength?: number;
      }
    > = {},
  ): DecryptionResult {
    const keyDerivation = options.keyDerivation || KEY_DERIVATION.PBKDF2;
    const keyLength = options.keyLength || 32;
    const saltBuffer = Buffer.from(salt, ENCODING.BASE64);

    // Derive key from password
    const key = this.deriveKey(
      password,
      saltBuffer,
      keyLength,
      keyDerivation,
      options.keyDerivationOptions,
    );

    // Decrypt data
    return this.decrypt(encrypted, key, iv, authTag, options);
  }

  // ---------------------- HASHING ----------------------

  /**
   * Compute hash of data.
   * @param data - Data to hash
   * @param algorithm - Hash algorithm
   * @param encoding - Output encoding
   * @returns Hash string
   */
  static hash(
    data: string | Buffer,
    algorithm: string = DEFAULT.HASH_ALGORITHM,
    encoding: string = ENCODING.HEX,
  ): string {
    const hash = createHash(algorithm);
    hash.update(data);
    return hash.digest(encoding);
  }

  /**
   * Compute SHA-256 hash.
   */
  static sha256(
    data: string | Buffer,
    encoding: string = ENCODING.HEX,
  ): string {
    return this.hash(data, HASH.SHA256, encoding);
  }

  /**
   * Compute SHA-384 hash.
   */
  static sha384(
    data: string | Buffer,
    encoding: string = ENCODING.HEX,
  ): string {
    return this.hash(data, HASH.SHA384, encoding);
  }

  /**
   * Compute SHA-512 hash.
   */
  static sha512(
    data: string | Buffer,
    encoding: string = ENCODING.HEX,
  ): string {
    return this.hash(data, HASH.SHA512, encoding);
  }

  /**
   * Compute MD5 hash (not for security, use for checksums only).
   */
  static md5(data: string | Buffer, encoding: string = ENCODING.HEX): string {
    return this.hash(data, HASH.MD5, encoding);
  }

  /**
   * HMAC with SHA-256.
   * @param data - Data to HMAC
   * @param key - HMAC key
   * @param encoding - Output encoding
   * @returns HMAC string
   */
  static hmacSha256(
    data: string | Buffer,
    key: Buffer | string,
    encoding: string = ENCODING.HEX,
  ): string {
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.UTF8) : key;
    const hmac = crypto.createHmac(HASH.SHA256, keyBuffer);
    hmac.update(data);
    return hmac.digest(encoding);
  }

  /**
   * HMAC with SHA-512.
   */
  static hmacSha512(
    data: string | Buffer,
    key: Buffer | string,
    encoding: string = ENCODING.HEX,
  ): string {
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.UTF8) : key;
    const hmac = crypto.createHmac(HASH.SHA512, keyBuffer);
    hmac.update(data);
    return hmac.digest(encoding);
  }

  // ---------------------- PASSWORD HASHING ----------------------

  /**
   * Hash a password using bcrypt.
   * @param password - Password to hash
   * @param rounds - Number of rounds (cost factor)
   * @returns Hashed password
   */
  static async hashPassword(
    password: string,
    rounds: number = DEFAULT.BCRYPT_ROUNDS,
  ): Promise<string> {
    try {
      return await bcrypt.hash(password, rounds);
    } catch (error) {
      logger.error(`Password hashing failed: ${error.message}`);
      throw new Error("Password hashing failed");
    }
  }

  /**
   * Hash a password synchronously using bcrypt.
   */
  static hashPasswordSync(
    password: string,
    rounds: number = DEFAULT.BCRYPT_ROUNDS,
  ): string {
    try {
      return bcrypt.hashSync(password, rounds);
    } catch (error) {
      logger.error(`Password hashing failed: ${error.message}`);
      throw new Error("Password hashing failed");
    }
  }

  /**
   * Verify a password against a hash.
   * @param password - Plain text password
   * @param hash - Hashed password
   * @returns True if password matches hash
   */
  static async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error(`Password verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify a password synchronously.
   */
  static verifyPasswordSync(password: string, hash: string): boolean {
    try {
      return bcrypt.compareSync(password, hash);
    } catch (error) {
      logger.error(`Password verification failed: ${error.message}`);
      return false;
    }
  }

  // ---------------------- SECURE COMPARISON ----------------------

  /**
   * Constant-time comparison to prevent timing attacks.
   * @param a - First string/buffer
   * @param b - Second string/buffer
   * @returns True if equal
   */
  static secureCompare(a: string | Buffer, b: string | Buffer): boolean {
    const aBuffer = typeof a === "string" ? Buffer.from(a, ENCODING.UTF8) : a;
    const bBuffer = typeof b === "string" ? Buffer.from(b, ENCODING.UTF8) : b;
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  }

  // ---------------------- ENCODING HELPERS ----------------------

  /**
   * Encode data to Base64.
   */
  static toBase64(data: string | Buffer): string {
    const buffer =
      typeof data === "string" ? Buffer.from(data, ENCODING.UTF8) : data;
    return buffer.toString(ENCODING.BASE64);
  }

  /**
   * Decode from Base64.
   */
  static fromBase64(data: string): Buffer {
    return Buffer.from(data, ENCODING.BASE64);
  }

  /**
   * Encode data to Base64URL (URL-safe).
   */
  static toBase64Url(data: string | Buffer): string {
    const buffer =
      typeof data === "string" ? Buffer.from(data, ENCODING.UTF8) : data;
    return buffer.toString(ENCODING.BASE64URL);
  }

  /**
   * Decode from Base64URL.
   */
  static fromBase64Url(data: string): Buffer {
    return Buffer.from(data, ENCODING.BASE64URL);
  }

  /**
   * Encode data to Hex.
   */
  static toHex(data: string | Buffer): string {
    const buffer =
      typeof data === "string" ? Buffer.from(data, ENCODING.UTF8) : data;
    return buffer.toString(ENCODING.HEX);
  }

  /**
   * Decode from Hex.
   */
  static fromHex(data: string): Buffer {
    return Buffer.from(data, ENCODING.HEX);
  }

  // ---------------------- TOKEN GENERATION ----------------------

  /**
   * Generate a secure access token (JWT-style).
   * @param payload - Data to encode in the token
   * @param secret - Secret key
   * @param expiresIn - Expiration time (e.g., '1h', '7d')
   * @returns Signed token
   */
  static generateToken(
    payload: Record<string, any>,
    secret: string,
    expiresIn: string = "1h",
  ): string {
    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = this.toBase64Url(JSON.stringify(header));
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + this.parseDuration(expiresIn);

    const payloadData = {
      ...payload,
      iat: now,
      exp: expiry,
    };

    const encodedPayload = this.toBase64Url(JSON.stringify(payloadData));
    const signature = this.hmacSha256(
      `${encodedHeader}.${encodedPayload}`,
      secret,
      ENCODING.BASE64URL,
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verify and decode a token.
   * @param token - JWT token
   * @param secret - Secret key
   * @returns Decoded payload
   */
  static verifyToken(token: string, secret: string): Record<string, any> {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid token format");
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      const expectedSignature = this.hmacSha256(
        `${encodedHeader}.${encodedPayload}`,
        secret,
        ENCODING.BASE64URL,
      );

      if (!this.secureCompare(signature, expectedSignature)) {
        throw new Error("Invalid signature");
      }

      const payload = JSON.parse(
        this.fromBase64Url(encodedPayload).toString(ENCODING.UTF8),
      );

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new Error("Token expired");
      }

      return payload;
    } catch (error) {
      logger.error(`Token verification failed: ${error.message}`);
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Parse duration string (e.g., '1h', '7d', '30m') to seconds.
   */
  static parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      default:
        throw new Error(`Unknown unit: ${unit}`);
    }
  }

  // ---------------------- ENCRYPTION KEY MANAGEMENT ----------------------

  /**
   * Generate a random encryption key.
   * @param length - Key length in bytes
   * @param encoding - Output encoding
   * @returns Encryption key
   */
  static generateKey(
    length: number = DEFAULT.KEY_LENGTH,
    encoding: string = ENCODING.BASE64,
  ): string {
    const key = randomBytes(length);
    return key.toString(encoding);
  }

  /**
   * Rotate encryption keys (derive new key from old key).
   * @param oldKey - Old encryption key
   * @param salt - Salt for key derivation
   * @param iterations - PBKDF2 iterations
   * @returns New encryption key
   */
  static rotateKey(
    oldKey: string,
    salt: string = "",
    iterations: number = 10000,
  ): string {
    const keyBuffer = Buffer.from(oldKey, ENCODING.BASE64);
    const saltBuffer = Buffer.from(salt || ENCODING.UTF8, ENCODING.UTF8);
    const newKey = crypto.pbkdf2Sync(
      keyBuffer,
      saltBuffer,
      iterations,
      DEFAULT.KEY_LENGTH,
      HASH.SHA256,
    );
    return newKey.toString(ENCODING.BASE64);
  }

  // ---------------------- FILE ENCRYPTION (STREAM) ----------------------

  /**
   * Encrypt a file using streaming (for large files).
   * @param inputPath - Source file path
   * @param outputPath - Destination file path
   * @param key - Encryption key
   * @param options - Encryption options
   * @returns Encryption metadata
   */
  static async encryptFile(
    inputPath: string,
    outputPath: string,
    key: Buffer | string,
    options: EncryptFileOptions = {},
  ): Promise<{ iv: string; authTag: string; algorithm: string }> {
    const algorithm = options.algorithm || DEFAULT.ENCRYPTION_ALGORITHM;
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.BASE64) : key;
    const iv = randomBytes(DEFAULT.IV_LENGTH);

    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    const readStream = createReadStream(inputPath);
    const writeStream = createWriteStream(outputPath);

    // Write IV at the beginning of the file
    writeStream.write(iv);

    const pipeAsync = promisify(pipeline);
    await pipeAsync(readStream, cipher, writeStream);

    return {
      iv: iv.toString(ENCODING.BASE64),
      authTag: cipher.getAuthTag().toString(ENCODING.BASE64),
      algorithm,
    };
  }

  /**
   * Decrypt a file using streaming.
   * @param inputPath - Encrypted file path
   * @param outputPath - Decrypted file path
   * @param key - Encryption key
   * @param iv - IV (base64 string)
   * @param authTag - Authentication tag (base64 string)
   * @param options - Decryption options
   */
  static async decryptFile(
    inputPath: string,
    outputPath: string,
    key: Buffer | string,
    iv: string,
    authTag: string,
    options: EncryptFileOptions = {},
  ): Promise<void> {
    const algorithm = options.algorithm || DEFAULT.ENCRYPTION_ALGORITHM;
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, ENCODING.BASE64) : key;
    const ivBuffer = Buffer.from(iv, ENCODING.BASE64);
    const authTagBuffer = Buffer.from(authTag, ENCODING.BASE64);

    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    const readStream = createReadStream(inputPath);
    const writeStream = createWriteStream(outputPath);

    // Skip the IV at the beginning of the file
    let isHeader = true;
    const originalRead = readStream.read.bind(readStream);
    readStream.read = function (size: number) {
      if (isHeader) {
        isHeader = false;
        // Skip the IV (16 bytes)
        const result = originalRead(size + DEFAULT.IV_LENGTH);
        if (Buffer.isBuffer(result) && result.length > DEFAULT.IV_LENGTH) {
          return result.slice(DEFAULT.IV_LENGTH);
        }
        return result;
      }
      return originalRead(size);
    };

    const pipeAsync = promisify(pipeline);
    await pipeAsync(readStream, decipher, writeStream);
  }

  // ---------------------- END ----------------------
}
