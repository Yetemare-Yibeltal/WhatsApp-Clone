// backend/src/common/utils/sanitize.util.ts
import { Logger } from '@nestjs/common';
import { isEmail, isPhoneNumber, isURL, isUUID } from 'class-validator';
import { escape, unescape } from 'lodash';

// -------- CONSTANTS --------
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
  '/': '&#047;',
  '`': '&#096;',
  '=': '&#061;',
};

const REVERSE_HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&#047;': '/',
  '&#096;': '`',
  '&#061;': '=',
};

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const SQL_KEYWORDS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'UNION', 'JOIN', 'WHERE'];

const DANGEROUS_HTML_TAGS = ['script', 'iframe', 'object', 'embed', 'applet', 'base', 'link', 'meta', 'style', 'form', 'input', 'button', 'textarea', 'select'];

const DANGEROUS_HTML_ATTRIBUTES = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect', 'onabort', 'onbeforeunload', 'onunload'];

const ALLOWED_URL_SCHEMES = ['http', 'https', 'ftp', 'mailto', 'tel', 'sms', 'ws', 'wss'];

// -------- LOGGER --------
const logger = new Logger('SanitizeUtil');

// -------- MAIN SANITIZE UTILITY CLASS --------
export class SanitizeUtil {
  /**
   * Escape HTML entities in a string to prevent XSS.
   * @param str - Input string
   * @returns Escaped string
   */
  static escapeHtml(str: any): string {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') {
      str = String(str);
    }
    return str.replace(/[&<>"'/`=]/g, (char) => HTML_ENTITIES[char] || char);
  }

  /**
   * Unescape HTML entities back to normal characters.
   * @param str - Escaped string
   * @returns Unescaped string
   */
  static unescapeHtml(str: string): string {
    if (!str || typeof str !== 'string') return str || '';
    return str.replace(/&amp;|&lt;|&gt;|&quot;|&#039;|&#047;|&#096;|&#061;/g, (match) => REVERSE_HTML_ENTITIES[match] || match);
  }

  /**
   * Escape JavaScript string literals.
   * @param str - Input string
   * @returns Escaped string
   */
  static escapeJs(str: any): string {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') {
      str = String(str);
    }
    return str.replace(/[\\"'\r\n\u2028\u2029]/g, (char) => {
      switch (char) {
        case '\\': return '\\\\';
        case '"': return '\\"';
        case "'": return "\\'";
        case '\r': return '\\r';
        case '\n': return '\\n';
        case '\u2028': return '\\u2028';
        case '\u2029': return '\\u2029';
        default: return char;
      }
    });
  }

  /**
   * Escape CSS string literals.
   * @param str - Input string
   * @returns Escaped string
   */
  static escapeCss(str: any): string {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') {
      str = String(str);
    }
    return str.replace(/[\\"'\r\n]/g, (char) => {
      switch (char) {
        case '\\': return '\\\\';
        case '"': return '\\"';
        case "'": return "\\'";
        case '\r': return '\\r';
        case '\n': return '\\n';
        default: return char;
      }
    });
  }

  /**
   * Escape URL parameters.
   * @param str - Input string
   * @returns Encoded string
   */
  static escapeUrl(str: any): string {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') {
      str = String(str);
    }
    return encodeURIComponent(str);
  }

  /**
   * Unescape URL parameters.
   * @param str - Encoded string
   * @returns Decoded string
   */
  static unescapeUrl(str: string): string {
    if (!str || typeof str !== 'string') return str || '';
    try {
      return decodeURIComponent(str);
    } catch (_) {
      return str;
    }
  }

  // ---------------------- SQL INJECTION PREVENTION ----------------------
  /**
   * Escape SQL string literals (for raw queries when parameterization isn't possible).
   * @param str - Input string
   * @returns Escaped string
   */
  static escapeSql(str: any): string {
    if (str === null || str === undefined) return 'NULL';
    if (typeof str !== 'string') {
      str = String(str);
    }
    return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  }

  /**
   * Check if a string contains SQL injection patterns.
   * @param str - Input string
   * @returns True if suspicious patterns found
   */
  static containsSqlInjection(str: any): boolean {
    if (!str || typeof str !== 'string') return false;
    const upper = str.toUpperCase();
    return SQL_KEYWORDS.some((keyword) => upper.includes(keyword));
  }

  /**
   * Sanitize a value for use in a SQL query (basic protection).
   * @param value - Value to sanitize
   * @returns Sanitized value
   */
  static sanitizeSqlValue(value: any): any {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      if (this.containsSqlInjection(value)) {
        logger.warn(`SQL injection pattern detected in value: ${value.substring(0, 50)}...`);
        // Return a sanitized version (strip potential SQL)
        return value.replace(/(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|UNION|JOIN)/gi, '');
      }
      return value;
    }
    return value;
  }

  // ---------------------- OBJECT SANITIZATION ----------------------
  /**
   * Recursively sanitize an object, removing dangerous keys/values.
   * @param obj - Object to sanitize
   * @param options - Sanitization options
   * @returns Sanitized object
   */
  static sanitizeObject<T extends Record<string, any>>(
    obj: T,
    options: {
      maxDepth?: number;
      removeEmpty?: boolean;
      allowedKeys?: string[];
      blockedKeys?: string[];
      sanitizeStrings?: boolean;
      trimStrings?: boolean;
    } = {},
  ): T {
    const { maxDepth = 10, removeEmpty = false, allowedKeys, blockedKeys, sanitizeStrings = true, trimStrings = true } = options;

    if (!obj || typeof obj !== 'object') return obj;

    const result: any = {};
    const depth = 0;

    function sanitizeValue(value: any, currentDepth: number): any {
      if (currentDepth > maxDepth) return value;

      if (value === null || value === undefined) {
        return removeEmpty ? undefined : value;
      }

      if (Array.isArray(value)) {
        return value
          .map((item) => sanitizeValue(item, currentDepth + 1))
          .filter((item) => !removeEmpty || item !== undefined);
      }

      if (typeof value === 'object') {
        const sanitized: any = {};
        for (const key of Object.keys(value)) {
          // Check allowed/blocked keys
          if (allowedKeys && !allowedKeys.includes(key)) continue;
          if (blockedKeys && blockedKeys.includes(key)) continue;

          const sanitizedValue = sanitizeValue(value[key], currentDepth + 1);
          if (!removeEmpty || sanitizedValue !== undefined) {
            sanitized[key] = sanitizedValue;
          }
        }
        return sanitized;
      }

      // String sanitization
      if (typeof value === 'string') {
        let str = value;
        if (trimStrings) {
          str = str.trim();
        }
        if (sanitizeStrings) {
          // Escape HTML and remove dangerous patterns
          str = this.escapeHtml(str);
          // Remove any null bytes
          str = str.replace(/\0/g, '');
        }
        return str || (removeEmpty ? undefined : str);
      }

      return value;
    }

    for (const key of Object.keys(obj)) {
      if (allowedKeys && !allowedKeys.includes(key)) continue;
      if (blockedKeys && blockedKeys.includes(key)) continue;

      const value = sanitizeValue(obj[key], depth + 1);
      if (!removeEmpty || value !== undefined) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Deep clone and sanitize an object (removes functions, circular refs).
   */
  static deepSanitize<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  // ---------------------- INPUT VALIDATION ----------------------
  /**
   * Validate an email address.
   */
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    return EMAIL_REGEX.test(email.trim());
  }

  /**
   * Validate a phone number (E.164 format).
   */
  static isValidPhone(phone: string): boolean {
    if (!phone || typeof phone !== 'string') return false;
    try {
      return isPhoneNumber(phone);
    } catch (_) {
      return false;
    }
  }

  /**
   * Validate a URL.
   */
  static isValidUrl(url: string, allowedSchemes: string[] = ALLOWED_URL_SCHEMES): boolean {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return allowedSchemes.includes(parsed.protocol.replace(':', ''));
    } catch (_) {
      return false;
    }
  }

  /**
   * Validate a UUID.
   */
  static isValidUuid(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    try {
      return isUUID(uuid);
    } catch (_) {
      return false;
    }
  }

  /**
   * Validate a boolean.
   */
  static isValidBoolean(value: any): boolean {
    return value === true || value === false || value === 'true' || value === 'false' || value === 1 || value === 0;
  }

  /**
   * Validate a number.
   */
  static isValidNumber(value: any): boolean {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }

  /**
   * Validate a date string.
   */
  static isValidDate(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Validate a string length.
   */
  static isValidLength(str: string, min: number, max: number): boolean {
    if (!str || typeof str !== 'string') return false;
    return str.length >= min && str.length <= max;
  }

  /**
   * Validate against a regex pattern.
   */
  static matchesPattern(str: string, pattern: RegExp): boolean {
    if (!str || typeof str !== 'string') return false;
    return pattern.test(str);
  }

  // ---------------------- NORMALIZATION ----------------------
  /**
   * Normalize an email address (lowercase, trim).
   */
  static normalizeEmail(email: string): string {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  }

  /**
   * Normalize a phone number (remove spaces, hyphens, parentheses).
   */
  static normalizePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') return '';
    return phone.replace(/[\s\-()]/g, '');
  }

  /**
   * Normalize a string (trim, lowercase).
   */
  static normalizeString(str: string, options: { lowercase?: boolean; uppercase?: boolean } = {}): string {
    if (!str || typeof str !== 'string') return '';
    let result = str.trim();
    if (options.lowercase) result = result.toLowerCase();
    if (options.uppercase) result = result.toUpperCase();
    return result;
  }

  /**
   * Slugify a string (URL-friendly).
   */
  static slugify(str: string): string {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ---------------------- HTML CONTENT SANITIZATION ----------------------
  /**
   * Sanitize HTML content (remove dangerous tags/attributes).
   * Uses a simple parser (not fully robust, but sufficient for basic use).
   * For production, consider using DOMPurify or similar.
   */
  static sanitizeHtml(html: string): string {
    if (!html || typeof html !== 'string') return '';

    // Remove script tags and contents
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove dangerous tags
    for (const tag of DANGEROUS_HTML_TAGS) {
      const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gis');
      sanitized = sanitized.replace(regex, '');
    }
    // Remove dangerous attributes
    for (const attr of DANGEROUS_HTML_ATTRIBUTES) {
      const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(regex, '');
      const regex2 = new RegExp(`\\s${attr}\\s*=\\s*[^\\s>]*`, 'gi');
      sanitized = sanitized.replace(regex2, '');
    }
    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');
    // Remove on* events (generic)
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    // Remove empty style attributes
    sanitized = sanitized.replace(/style\s*=\s*["']\s*["']/gi, '');

    return sanitized;
  }

  /**
   * Sanitize JSON data (recursively remove dangerous fields).
   */
  static sanitizeJson<T>(data: T): T {
    if (!data || typeof data !== 'object') return data;
    return this.sanitizeObject(data as any) as T;
  }

  // ---------------------- FILE NAME SANITIZATION ----------------------
  /**
   * Sanitize a file name for safe storage.
   */
  static sanitizeFileName(filename: string): string {
    if (!filename || typeof filename !== 'string') return 'unnamed';

    // Remove path traversal
    let sanitized = filename.replace(/\.\./g, '');
    sanitized = sanitized.replace(/[\/\\]/g, '-');
    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*]/g, '');
    // Keep only alphanumeric, dot, hyphen, underscore
    sanitized = sanitized.replace(/[^a-zA-Z0-9.\-_]/g, '');
    // Limit length
    if (sanitized.length > 255) {
      sanitized = sanitized.substring(0, 255);
    }
    return sanitized.trim() || 'unnamed';
  }

  // ---------------------- CONTEXTUAL SANITIZATION ----------------------
  /**
   * Sanitize a value based on its intended context.
   */
  static sanitizeForContext(
    value: any,
    context: 'html' | 'js' | 'css' | 'url' | 'sql' | 'plain',
  ): string {
    if (value === null || value === undefined) return '';
    const str = String(value);

    switch (context) {
      case 'html':
        return this.escapeHtml(str);
      case 'js':
        return this.escapeJs(str);
      case 'css':
        return this.escapeCss(str);
      case 'url':
        return this.escapeUrl(str);
      case 'sql':
        return this.escapeSql(str);
      case 'plain':
      default:
        return this.sanitizePlain(str);
    }
  }

  /**
   * Sanitize plain text (remove control characters).
   */
  static sanitizePlain(str: string): string {
    if (!str || typeof str !== 'string') return '';
    // Remove control characters (except newline, tab)
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  // ---------------------- XSS PREVENTION HELPERS ----------------------
  /**
   * Check if a string contains potential XSS.
   */
  static containsXss(value: any): boolean {
    if (!value || typeof value !== 'string') return false;
    const patterns = [
      /<script\b/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe\b/i,
      /<object\b/i,
      /<embed\b/i,
      /<applet\b/i,
      /<base\b/i,
    ];
    return patterns.some((pattern) => pattern.test(value));
  }

  /**
   * Remove XSS patterns from a string.
   */
  static removeXss(value: any): string {
    if (!value || typeof value !== 'string') return '';
    let sanitized = value;
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
    sanitized = sanitized.replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '');
    sanitized = sanitized.replace(/<object\b[^>]*>.*?<\/object>/gi, '');
    sanitized = sanitized.replace(/<embed\b[^>]*>/gi, '');
    sanitized = sanitized.replace(/<applet\b[^>]*>.*?<\/applet>/gi, '');
    sanitized = sanitized.replace(/<base\b[^>]*>/gi, '');
    return sanitized;
  }

  // ---------------------- INPUT SANITIZATION (FULL) ----------------------
  /**
   * Full input sanitization (combines multiple methods).
   */
  static sanitizeInput(input: any, options: { trim?: boolean; escapeHtml?: boolean; removeXss?: boolean; maxLength?: number } = {}): any {
    if (input === null || input === undefined) return input;

    const { trim = true, escapeHtml = true, removeXss = true, maxLength } = options;

    if (typeof input === 'string') {
      let result = input;
      if (trim) result = result.trim();
      if (maxLength && result.length > maxLength) {
        result = result.substring(0, maxLength);
      }
      if (removeXss) result = this.removeXss(result);
      if (escapeHtml) result = this.escapeHtml(result);
      return result;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitizeInput(item, options));
    }

    if (typeof input === 'object') {
      const result: any = {};
      for (const key of Object.keys(input)) {
        result[key] = this.sanitizeInput(input[key], options);
      }
      return result;
    }

    return input;
  }

  // ---------------------- KEY FILTERING ----------------------
  /**
   * Filter object keys to only allow specified keys.
   */
  static filterKeys<T extends Record<string, any>>(
    obj: T,
    allowedKeys: string[],
  ): Partial<T> {
    if (!obj || typeof obj !== 'object') return {};
    const result: any = {};
    for (const key of allowedKeys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  /**
   * Remove specified keys from an object.
   */
  static removeKeys<T extends Record<string, any>>(
    obj: T,
    keysToRemove: string[],
  ): Partial<T> {
    if (!obj || typeof obj !== 'object') return {};
    const result = { ...obj };
    for (const key of keysToRemove) {
      delete result[key];
    }
    return result;
  }

  // ---------------------- DATA MASKING ----------------------
  /**
   * Mask sensitive data (e.g., email, phone, credit card).
   */
  static maskData(value: string, maskChar: string = '*'): string {
    if (!value || typeof value !== 'string') return value;

    // Email: show first 2 chars and domain
    if (this.isValidEmail(value)) {
      const [local, domain] = value.split('@');
      if (local.length <= 2) {
        return `${local}@${domain}`;
      }
      return `${local.substring(0, 2)}${maskChar.repeat(local.length - 2)}@${domain}`;
    }

    // Phone: show last 4 digits
    if (this.isValidPhone(value)) {
      const clean = this.normalizePhone(value);
      if (clean.length <= 4) {
        return clean;
      }
      return `${maskChar.repeat(clean.length - 4)}${clean.substring(clean.length - 4)}`;
    }

    // Default: mask all but first 2 and last 2 chars
    if (value.length <= 4) {
      return value;
    }
    return `${value.substring(0, 2)}${maskChar.repeat(value.length - 4)}${value.substring(value.length - 2)}`;
  }

  // ---------------------- REDACTION HELPERS ----------------------
  /**
   * Redact sensitive data from an object (deep).
   */
  static redactSensitiveData<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: string[] = ['password', 'token', 'secret', 'credit_card', 'cvv', 'ssn', 'authorization'],
  ): T {
    if (!obj || typeof obj !== 'object') return obj;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const shouldRedact = sensitiveFields.some((field) =>
        key.toLowerCase().includes(field.toLowerCase()) ||
        field.toLowerCase().includes(key.toLowerCase()),
      );

      if (shouldRedact) {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        result[key] = this.redactSensitiveData(value, sensitiveFields);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // ---------------------- BATCH PROCESSING ----------------------
  /**
   * Sanitize multiple values in batch.
   */
  static batchSanitize(
    inputs: Record<string, any>,
    options: {
      trim?: boolean;
      escapeHtml?: boolean;
      removeXss?: boolean;
      maxLength?: number;
      fields?: Record<string, { trim?: boolean; escapeHtml?: boolean; removeXss?: boolean; maxLength?: number }>;
    } = {},
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(inputs)) {
      const fieldOptions = options.fields?.[key] || {};
      result[key] = this.sanitizeInput(value, {
        trim: fieldOptions.trim !== undefined ? fieldOptions.trim : options.trim,
        escapeHtml: fieldOptions.escapeHtml !== undefined ? fieldOptions.escapeHtml : options.escapeHtml,
        removeXss: fieldOptions.removeXss !== undefined ? fieldOptions.removeXss : options.removeXss,
        maxLength: fieldOptions.maxLength || options.maxLength,
      });
    }

    return result;
  }

  // ---------------------- UTILITY HELPERS ----------------------
  /**
   * Check if a value is safe (no dangerous patterns).
   */
  static isSafe(value: any): boolean {
    if (typeof value === 'string') {
      return !this.containsXss(value) && !this.containsSqlInjection(value);
    }
    if (typeof value === 'object' && value !== null) {
      for (const v of Object.values(value)) {
        if (!this.isSafe(v)) return false;
      }
      return true;
    }
    return true;
  }

  /**
   * Get a safe version of a value (with fallback).
   */
  static safeValue(value: any, fallback: any = ''): any {
    if (this.isSafe(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return this.removeXss(value) || fallback;
    }
    return fallback;
  }

  /**
   * Truncate a string to a specific length and append ellipsis if needed.
   */
  static truncate(str: string, maxLength: number, ellipsis: string = '...'): string {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - ellipsis.length) + ellipsis;
  }

  // ---------------------- END ----------------------
}