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

/**
 * Creates a secure proxy of an object that prevents access to dangerous properties
 * like 'constructor' and '__proto__', preventing sandbox escapes via `this.constructor.constructor`.
 */
function secureProxy<T extends object>(target: T): T {
  // If target is primitive, return as is
  if (typeof target !== 'object' && typeof target !== 'function' || target === null) {
    return target;
  }

  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      // Block access to dangerous properties
      if (prop === 'constructor' || prop === '__proto__' || prop === 'prototype') {
        return undefined;
      }

      const value = Reflect.get(target, prop, receiver);

      // Recursively proxy the retrieved value
      return secureProxy(value);
    },

    apply(target, thisArg, args) {
      // Execute the function
      const result = Reflect.apply(target as Function, thisArg, args);
      // Proxy the result
      return secureProxy(result);
    }
  };

  return new Proxy(target, handler);
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
    // Basic static analysis to reject obviously dangerous scripts
    const dangerousKeywords = ['process', 'require', 'import', 'global', 'eval', 'Function'];
    for (const keyword of dangerousKeywords) {
        // Simple check: keyword followed by boundary or non-identifier char
        // This is not perfect but adds a layer of defense.
        const regex = new RegExp(`\\b${keyword}\\b`);
        if (regex.test(pattern.script)) {
            return Promise.reject(new Error(`Security Error: Script contains forbidden keyword '${keyword}'`));
        }
    }

    return new Promise((resolve, reject) => {
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
      this.db.all('SELECT * FROM star_combinations', (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows as Pattern[]);
      });
    });
  }

  public async evaluatePatterns(chart: IFunctionalAstrolabe): Promise<Pattern[]> {
    const patterns = await this.getAllPatterns();
    const matches: Pattern[] = [];

    // Create a safe context with no prototype chain
    const context = vm.createContext(Object.create(null));

    // Inject the chart object wrapped in a secure proxy
    context.chart = secureProxy(chart);

    for (const p of patterns) {
      try {
        // The script should evaluate to a boolean
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
