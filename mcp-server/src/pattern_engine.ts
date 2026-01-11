// mcp-server/src/pattern_engine.ts
import sqlite3 from 'sqlite3';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
import type { IFunctionalAstrolabe } from '../../lib/astro/FunctionalAstrolabe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'patterns.db');

export interface Pattern {
  id?: number;
  name: string;
  script: string;
  description: string;
  examples: string;
}

// Security: Blacklist dangerous keywords
const BLACKLIST = [
  'process', 'require', 'eval', 'Function',
  'constructor', '__proto__', 'prototype',
  'import', 'global', 'globalThis'
];

function validateScript(script: string): void {
  const pattern = new RegExp(`\\b(${BLACKLIST.join('|')})\\b`);
  if (pattern.test(script)) {
    throw new Error(`Script contains forbidden keywords.`);
  }
}

// Security: Recursive proxy to enforce read-only access and block prototype traversal
function secureProxy<T>(target: T, seen = new WeakMap()): T {
  // Fix: typeof function is 'function', not 'object'. We must handle it.
  if (target === null || (typeof target !== 'object' && typeof target !== 'function')) {
    return target;
  }

  // @ts-expect-error WeakMap key must be object
  if (seen.has(target)) {
    // @ts-expect-error WeakMap key must be object
    return seen.get(target);
  }

  const proxy = new Proxy(target as object, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get(target: any, prop: string | symbol, receiver: any) {
      // Block dangerous properties
      if (prop === 'constructor' || prop === '__proto__' || prop === 'prototype') {
        return undefined;
      }

      const value = Reflect.get(target, prop, receiver);

      if (typeof value === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return function (...args: any[]) {
          // Bind 'this' to the original target to avoid proxy incompatibility issues with internal slots
          const result = value.apply(target, args);
          return secureProxy(result, seen);
        }
      }

      return secureProxy(value, seen);
    },
    set() {
      return false; // Read-only
    },
    deleteProperty() {
      return false; // Read-only
    },
    defineProperty() {
      return false;
    },
    setPrototypeOf() {
      return false;
    }
  });

  // @ts-expect-error WeakMap key must be object
  seen.set(target, proxy);
  return proxy as T;
}

export class PatternEngine {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err: Error | null) => {
      if (err) {
        console.error('Error opening database', err);
      } else {
        this.initDb();
      }
    });
  }

  private initDb() {
    this.db.run(`CREATE TABLE IF NOT EXISTS star_combinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      script TEXT NOT NULL,
      description TEXT,
      examples TEXT
    )`);
  }

  public addPattern(pattern: Pattern): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        validateScript(pattern.script);
      } catch (e) {
        return reject(e);
      }

      const stmt = this.db.prepare(
        'INSERT INTO star_combinations (name, script, description, examples) VALUES (?, ?, ?, ?)'
      );
      stmt.run(
        [pattern.name, pattern.script, pattern.description, pattern.examples],
        function (this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
      stmt.finalize();
    });
  }

  public getAllPatterns(): Promise<Pattern[]> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.db.all('SELECT * FROM star_combinations', (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows as Pattern[]);
      });
    });
  }

  public async evaluatePatterns(chart: IFunctionalAstrolabe): Promise<Pattern[]> {
    const patterns = await this.getAllPatterns();
    const matches: Pattern[] = [];

    // Create a safe context for execution
    // We only expose the 'chart' object.
    const context = vm.createContext({ chart: secureProxy(chart) });

    for (const p of patterns) {
      try {
        // The script should evaluate to a boolean
        // e.g. "chart.palace('命宫').has('紫微')"
        const result = vm.runInContext(p.script, context, { timeout: 100 });
        if (result === true) {
          matches.push(p);
        }
      } catch (e) {
        // console.warn(`Pattern '${p.name}' execution failed:`, e);
        // Fail silently or log, but don't crash
      }
    }
    return matches;
  }
}

export const patternEngine = new PatternEngine();
