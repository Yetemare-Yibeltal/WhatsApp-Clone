// backend/src/common/utils/slugify.util.ts
import { Logger } from "@nestjs/common";
import { randomBytes } from "crypto";
import { isUUID } from "class-validator";

// -------- CONSTANTS --------
const DEFAULT_SEPARATOR = "-";
const DEFAULT_MAX_LENGTH = 100;
const DEFAULT_REPLACEMENTS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  Ä: "Ae",
  Ö: "Oe",
  Ü: "Ue",
  ß: "ss",
  ç: "c",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  ï: "i",
  î: "i",
  ô: "o",
  ö: "oe",
  ò: "o",
  ó: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ñ: "n",
  ý: "y",
  ÿ: "y",
  ø: "o",
  å: "a",
  æ: "ae",
  œ: "oe",
};
const RESERVED_SLUGS = [
  "admin",
  "api",
  "auth",
  "login",
  "register",
  "dashboard",
  "settings",
  "profile",
  "users",
  "groups",
  "messages",
  "search",
  "static",
  "assets",
  "public",
  "private",
  "www",
  "mail",
  "ftp",
  "ssh",
  "ssl",
  "tls",
  "http",
  "https",
  "ws",
  "wss",
];

// -------- LOGGER --------
const logger = new Logger("SlugifyUtil");

// -------- INTERFACES --------
export interface SlugifyOptions {
  /**
   * Separator to use between words.
   * @default '-'
   */
  separator?: string;

  /**
   * Maximum length of the slug.
   * @default 100
   */
  maxLength?: number;

  /**
   * Replacements for special characters.
   */
  replacements?: Record<string, string>;

  /**
   * Allowed characters (regex).
   * @default /[^a-zA-Z0-9-]/g
   */
  allowedCharsRegex?: RegExp;

  /**
   * Truncate at the end or at word boundary.
   * @default true (truncate at end)
   */
  truncateAtWordBoundary?: boolean;

  /**
   * Lowercase the slug.
   * @default true
   */
  lowercase?: boolean;

  /**
   * Remove stop words.
   * @default false
   */
  removeStopWords?: boolean;

  /**
   * Custom stop words to remove.
   */
  stopWords?: string[];

  /**
   * Preserve case (if lowercase is false).
   * @default false
   */
  preserveCase?: boolean;

  /**
   * Add a random suffix to ensure uniqueness.
   * @default false
   */
  addRandomSuffix?: boolean;

  /**
   * Random suffix length.
   * @default 6
   */
  randomSuffixLength?: number;

  /**
   * Maximum attempts for unique slug generation.
   * @default 10
   */
  maxAttempts?: number;
}

export interface UniqueSlugOptions extends SlugifyOptions {
  /**
   * Check if slug exists in the database.
   */
  existsCheck: (slug: string) => Promise<boolean> | boolean;

  /**
   * If true, when slug exists, append a number.
   * @default true
   */
  incrementOnExists?: boolean;

  /**
   * The number to start incrementing from.
   * @default 1
   */
  incrementStart?: number;

  /**
   * If true, will also check for reserved slugs.
   * @default true
   */
  checkReserved?: boolean;

  /**
   * Model identifier for logging.
   */
  model?: string;

  /**
   * Existing item ID to exclude from uniqueness check (for updates).
   */
  excludeId?: string | number;
}

export interface SlugHistory {
  id: string;
  slug: string;
  createdAt: Date;
  targetId: string;
  targetType: string;
}

// -------- MAIN SLUGIFY UTILITY CLASS --------
export class SlugifyUtil {
  /**
   * Generate a slug from a string.
   * @param input - String to convert to slug
   * @param options - Slugify options
   * @returns Generated slug
   */
  static slugify(input: string, options: SlugifyOptions = {}): string {
    if (!input || typeof input !== "string") {
      logger.warn("Invalid input for slugify, returning empty string");
      return "";
    }

    const opts = this.normalizeOptions(options);
    let slug = input.trim();

    // ---- 1. Replace special characters ----
    const replacements = { ...DEFAULT_REPLACEMENTS, ...opts.replacements };
    for (const [key, value] of Object.entries(replacements)) {
      slug = slug.replace(new RegExp(key, "g"), value);
    }

    // ---- 2. Remove stop words ----
    if (opts.removeStopWords) {
      const stopWords = opts.stopWords || this.getDefaultStopWords();
      const words = slug.split(/\s+/);
      slug = words
        .filter((w) => !stopWords.includes(w.toLowerCase()))
        .join(" ");
    }

    // ---- 3. Normalize to lowercase (optional) ----
    if (opts.lowercase) {
      slug = slug.toLowerCase();
    }

    // ---- 4. Replace non‑allowed characters ----
    const allowedRegex = opts.allowedCharsRegex || /[^a-zA-Z0-9-]/g;
    slug = slug.replace(allowedRegex, opts.separator);

    // ---- 5. Collapse multiple separators ----
    slug = slug.replace(
      new RegExp(`\\${opts.separator}+`, "g"),
      opts.separator,
    );

    // ---- 6. Trim separators from ends ----
    slug = slug.replace(
      new RegExp(`^\\${opts.separator}|\\${opts.separator}$`, "g"),
      "",
    );

    // ---- 7. Truncate to max length ----
    if (opts.maxLength && slug.length > opts.maxLength) {
      if (opts.truncateAtWordBoundary) {
        // Find last separator within limit
        const slice = slug.substring(0, opts.maxLength);
        const lastSep = slice.lastIndexOf(opts.separator);
        if (lastSep > 0) {
          slug = slice.substring(0, lastSep);
        } else {
          slug = slice;
        }
      } else {
        slug = slug.substring(0, opts.maxLength);
      }
    }

    // ---- 8. Add random suffix ----
    if (opts.addRandomSuffix) {
      const suffix = randomBytes(Math.ceil((opts.randomSuffixLength || 6) / 2))
        .toString("hex")
        .substring(0, opts.randomSuffixLength || 6);
      slug = `${slug}${opts.separator}${suffix}`;
    }

    // ---- 9. Final fallback ----
    if (!slug) {
      slug = `slug-${Date.now()}`;
    }

    return slug;
  }

  /**
   * Generate a unique slug (ensures slug is not already in use).
   * @param input - String to convert
   * @param options - Unique slug options
   * @returns Unique slug
   */
  static async generateUniqueSlug(
    input: string,
    options: UniqueSlugOptions,
  ): Promise<string> {
    if (!options.existsCheck) {
      throw new Error(
        "existsCheck function is required for unique slug generation",
      );
    }

    const baseSlug = this.slugify(input, options);
    if (!baseSlug) {
      throw new Error("Failed to generate base slug from input");
    }

    const opts = { ...options };
    const separator = opts.separator || DEFAULT_SEPARATOR;
    const maxAttempts = opts.maxAttempts || 10;
    const incrementStart = opts.incrementStart || 1;
    const checkReserved = opts.checkReserved !== false;

    let slug = baseSlug;
    let attempt = 0;
    let suffix = 0;

    while (attempt < maxAttempts) {
      attempt++;

      // ---- Check reserved slugs ----
      if (checkReserved && this.isReserved(slug)) {
        // If reserved, try with suffix
        if (suffix === 0) {
          suffix = incrementStart;
        }
        slug = `${baseSlug}${separator}${suffix}`;
        suffix++;
        continue;
      }

      // ---- Check if slug exists ----
      const exists = await this.checkSlugExists(slug, opts);
      if (!exists) {
        // Slug is unique
        return slug;
      }

      // ---- Slug exists, generate new one with suffix ----
      if (suffix === 0) {
        suffix = incrementStart;
      }
      slug = `${baseSlug}${separator}${suffix}`;
      suffix++;
    }

    // If we exhausted attempts, add timestamp
    const fallback = `${baseSlug}${separator}${Date.now()}`;
    logger.warn(
      `Max attempts (${maxAttempts}) reached for slug generation, using fallback: ${fallback}`,
    );
    return fallback;
  }

  /**
   * Synchronous version of generateUniqueSlug.
   */
  static generateUniqueSlugSync(
    input: string,
    options: UniqueSlugOptions,
  ): string {
    if (!options.existsCheck) {
      throw new Error(
        "existsCheck function is required for unique slug generation",
      );
    }

    const baseSlug = this.slugify(input, options);
    if (!baseSlug) {
      throw new Error("Failed to generate base slug from input");
    }

    const opts = { ...options };
    const separator = opts.separator || DEFAULT_SEPARATOR;
    const maxAttempts = opts.maxAttempts || 10;
    const incrementStart = opts.incrementStart || 1;
    const checkReserved = opts.checkReserved !== false;

    let slug = baseSlug;
    let attempt = 0;
    let suffix = 0;

    while (attempt < maxAttempts) {
      attempt++;

      if (checkReserved && this.isReserved(slug)) {
        if (suffix === 0) {
          suffix = incrementStart;
        }
        slug = `${baseSlug}${separator}${suffix}`;
        suffix++;
        continue;
      }

      const exists = this.checkSlugExistsSync(slug, opts);
      if (!exists) {
        return slug;
      }

      if (suffix === 0) {
        suffix = incrementStart;
      }
      slug = `${baseSlug}${separator}${suffix}`;
      suffix++;
    }

    const fallback = `${baseSlug}${separator}${Date.now()}`;
    logger.warn(
      `Max attempts reached for slug generation, using fallback: ${fallback}`,
    );
    return fallback;
  }

  // ---------------------- HELPERS FOR EXISTENCE CHECKS ----------------------
  /**
   * Check if a slug exists (async).
   */
  private static async checkSlugExists(
    slug: string,
    options: UniqueSlugOptions,
  ): Promise<boolean> {
    const existsCheck = options.existsCheck;
    const excludeId = options.excludeId;

    let exists = await existsCheck(slug);
    // If there's an excluded ID, we need to handle it differently
    // We assume the existsCheck takes the slug and returns true if any record with that slug exists
    // Exclude logic should be handled in the existsCheck function itself.
    // We'll pass the excludeId as an option to the existsCheck if needed.
    // For simplicity, we'll just call existsCheck.
    return exists;
  }

  /**
   * Check if a slug exists (sync).
   */
  private static checkSlugExistsSync(
    slug: string,
    options: UniqueSlugOptions,
  ): boolean {
    const existsCheck = options.existsCheck;
    if (typeof existsCheck === "function") {
      // If it's a synchronous function, it returns boolean; if async, we can't use it.
      // We'll cast to boolean and hope for the best.
      const result = existsCheck(slug);
      if (typeof result === "boolean") {
        return result;
      }
      // If it's a Promise, we can't handle sync; we'll treat as false and log.
      logger.warn(
        "existsCheck returned a Promise in synchronous context, treating as false",
      );
      return false;
    }
    return existsCheck === true;
  }

  // ---------------------- RESERVED SLUGS ----------------------
  /**
   * Check if a slug is reserved.
   */
  static isReserved(
    slug: string,
    reservedList: string[] = RESERVED_SLUGS,
  ): boolean {
    if (!slug || typeof slug !== "string") return false;
    return reservedList.includes(slug.toLowerCase());
  }

  /**
   * Get the default list of reserved slugs.
   */
  static getDefaultReservedSlugs(): string[] {
    return [...RESERVED_SLUGS];
  }

  /**
   * Add a custom reserved slug.
   */
  static addReservedSlug(slug: string): void {
    if (!RESERVED_SLUGS.includes(slug.toLowerCase())) {
      RESERVED_SLUGS.push(slug.toLowerCase());
      logger.log(`Added reserved slug: ${slug}`);
    }
  }

  /**
   * Remove a reserved slug.
   */
  static removeReservedSlug(slug: string): void {
    const index = RESERVED_SLUGS.indexOf(slug.toLowerCase());
    if (index > -1) {
      RESERVED_SLUGS.splice(index, 1);
      logger.log(`Removed reserved slug: ${slug}`);
    }
  }

  // ---------------------- STOP WORDS ----------------------
  /**
   * Get default stop words.
   */
  static getDefaultStopWords(): string[] {
    return [
      "a",
      "an",
      "the",
      "and",
      "or",
      "but",
      "nor",
      "for",
      "so",
      "yet",
      "in",
      "on",
      "at",
      "to",
      "by",
      "with",
      "from",
      "up",
      "down",
      "off",
      "of",
      "for",
      "about",
      "across",
      "after",
      "against",
      "along",
      "among",
      "around",
      "as",
      "at",
      "before",
      "behind",
      "below",
      "beneath",
      "beside",
      "between",
      "beyond",
      "during",
      "except",
      "inside",
      "into",
      "near",
      "outside",
      "over",
      "through",
      "throughout",
      "toward",
      "under",
      "up",
      "upon",
      "within",
      "without",
    ];
  }

  // ---------------------- OPTIONS NORMALIZATION ----------------------
  private static normalizeOptions(
    options: SlugifyOptions,
  ): Required<Omit<SlugifyOptions, "replacements" | "stopWords">> & {
    replacements: Record<string, string>;
    stopWords: string[];
  } {
    return {
      separator: options.separator || DEFAULT_SEPARATOR,
      maxLength: options.maxLength || DEFAULT_MAX_LENGTH,
      replacements: options.replacements || {},
      allowedCharsRegex: options.allowedCharsRegex || /[^a-zA-Z0-9-]/g,
      truncateAtWordBoundary:
        options.truncateAtWordBoundary !== undefined
          ? options.truncateAtWordBoundary
          : true,
      lowercase: options.lowercase !== undefined ? options.lowercase : true,
      removeStopWords: options.removeStopWords || false,
      stopWords: options.stopWords || [],
      preserveCase: options.preserveCase || false,
      addRandomSuffix: options.addRandomSuffix || false,
      randomSuffixLength: options.randomSuffixLength || 6,
      maxAttempts: options.maxAttempts || 10,
    };
  }

  // ---------------------- VALIDATION ----------------------
  /**
   * Validate a slug (check format, length, reserved).
   */
  static isValidSlug(
    slug: string,
    options: {
      minLength?: number;
      maxLength?: number;
      allowedCharsRegex?: RegExp;
      checkReserved?: boolean;
      checkTrailingDash?: boolean;
    } = {},
  ): boolean {
    if (!slug || typeof slug !== "string") return false;

    const {
      minLength = 1,
      maxLength = 100,
      allowedCharsRegex = /^[a-z0-9-]+$/,
      checkReserved = true,
      checkTrailingDash = true,
    } = options;

    // Length
    if (slug.length < minLength || slug.length > maxLength) return false;

    // Allowed characters (must match)
    if (!allowedCharsRegex.test(slug)) return false;

    // Reserved
    if (checkReserved && this.isReserved(slug)) return false;

    // No trailing dash
    if (checkTrailingDash && slug.endsWith("-")) return false;

    // No leading dash (should be caught by regex, but check anyway)
    if (slug.startsWith("-")) return false;

    return true;
  }

  /**
   * Normalize a slug (sanitize to a consistent format).
   */
  static normalizeSlug(
    slug: string,
    options: { lowercase?: boolean; separator?: string } = {},
  ): string {
    if (!slug || typeof slug !== "string") return "";

    let normalized = slug;
    const separator = options.separator || DEFAULT_SEPARATOR;

    // Lowercase
    if (options.lowercase !== false) {
      normalized = normalized.toLowerCase();
    }

    // Replace invalid characters with separator
    normalized = normalized.replace(/[^a-z0-9-]/g, separator);

    // Collapse separators
    normalized = normalized.replace(
      new RegExp(`\\${separator}+`, "g"),
      separator,
    );

    // Trim separators
    normalized = normalized.replace(
      new RegExp(`^\\${separator}|\\${separator}$`, "g"),
      "",
    );

    return normalized || `slug-${Date.now()}`;
  }

  // ---------------------- BATCH GENERATION ----------------------
  /**
   * Generate slugs for multiple items in batch.
   */
  static async batchGenerateSlugs(
    items: Array<{ input: string; options?: UniqueSlugOptions }>,
  ): Promise<string[]> {
    const results: string[] = [];
    for (const item of items) {
      const slug = await this.generateUniqueSlug(
        item.input,
        item.options || { existsCheck: () => false },
      );
      results.push(slug);
    }
    return results;
  }

  /**
   * Sync version of batchGenerateSlugs.
   */
  static batchGenerateSlugsSync(
    items: Array<{ input: string; options?: UniqueSlugOptions }>,
  ): string[] {
    const results: string[] = [];
    for (const item of items) {
      const slug = this.generateUniqueSlugSync(
        item.input,
        item.options || { existsCheck: () => false },
      );
      results.push(slug);
    }
    return results;
  }

  // ---------------------- SLUG HISTORY MANAGEMENT ----------------------
  /**
   * Store a slug history record (for redirects).
   * To be used with a database or cache.
   */
  static async storeSlugHistory(
    history: SlugHistory,
    storage: (history: SlugHistory) => Promise<void>,
  ): Promise<void> {
    await storage(history);
  }

  /**
   * Find slug history by slug.
   */
  static async findSlugHistory(
    slug: string,
    fetcher: (slug: string) => Promise<SlugHistory | null>,
  ): Promise<SlugHistory | null> {
    return fetcher(slug);
  }

  // ---------------------- RANDOM SLUG GENERATION ----------------------
  /**
   * Generate a random slug (for fallback).
   */
  static generateRandomSlug(length: number = 8): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // ---------------------- SLUG TRANSFORMATION ----------------------
  /**
   * Convert a slug back to a human-readable title.
   */
  static slugToTitle(
    slug: string,
    separator: string = DEFAULT_SEPARATOR,
  ): string {
    if (!slug || typeof slug !== "string") return "";
    return slug
      .split(separator)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Convert a slug to a kebab-case string (lowercase, hyphenated).
   */
  static toKebabCase(slug: string): string {
    return this.normalizeSlug(slug, { lowercase: true, separator: "-" });
  }

  /**
   * Convert a slug to a snake_case string (lowercase, underscores).
   */
  static toSnakeCase(slug: string): string {
    if (!slug || typeof slug !== "string") return "";
    return slug.replace(/-/g, "_").toLowerCase();
  }

  /**
   * Convert a slug to a camelCase string.
   */
  static toCamelCase(
    slug: string,
    separator: string = DEFAULT_SEPARATOR,
  ): string {
    if (!slug || typeof slug !== "string") return "";
    const parts = slug.split(separator);
    if (parts.length === 0) return "";
    const first = parts[0].toLowerCase();
    const rest = parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    return first + rest.join("");
  }

  /**
   * Convert a slug to a PascalCase string.
   */
  static toPascalCase(
    slug: string,
    separator: string = DEFAULT_SEPARATOR,
  ): string {
    if (!slug || typeof slug !== "string") return "";
    return this.toCamelCase(slug, separator).replace(/^./, (char) =>
      char.toUpperCase(),
    );
  }

  // ---------------------- COMPRESSION / SHORTENING ----------------------
  /**
   * Shorten a slug to a given length while preserving uniqueness as much as possible.
   */
  static shortenSlug(
    slug: string,
    maxLength: number,
    separator: string = DEFAULT_SEPARATOR,
  ): string {
    if (!slug || typeof slug !== "string") return "";
    if (slug.length <= maxLength) return slug;

    // Try to find a word boundary near the maxLength
    const slice = slug.substring(0, maxLength);
    const lastSep = slice.lastIndexOf(separator);
    if (lastSep > 0) {
      return slice.substring(0, lastSep);
    }
    return slice;
  }

  // ---------------------- SLUG COMPARISON ----------------------
  /**
   * Compare two slugs for equality (case-insensitive).
   */
  static areEqual(slug1: string, slug2: string): boolean {
    if (
      !slug1 ||
      !slug2 ||
      typeof slug1 !== "string" ||
      typeof slug2 !== "string"
    )
      return false;
    return slug1.toLowerCase() === slug2.toLowerCase();
  }

  // ---------------------- END ----------------------
}
