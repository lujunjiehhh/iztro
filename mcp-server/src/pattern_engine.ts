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
      // Basic sanitization
      if (pattern.script.includes('process') || pattern.script.includes('require') || pattern.script.includes('import')) {
         return reject(new Error("Script contains forbidden keywords"));
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
      this.db.all('SELECT * FROM star_combinations', (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows as Pattern[]);
      });
    });
  }

  private secureProxy<T extends object>(target: T): T {
    const handler: ProxyHandler<T> = {
      get: (target: T, prop: string | symbol, receiver: any) => {
        if (prop === 'constructor' || prop === 'prototype' || prop === '__proto__') {
          return undefined;
        }

        const value = Reflect.get(target, prop, receiver);

        if (typeof value === 'function') {
           return (...args: any[]) => {
               const result = value.apply(target, args);
               if (result && typeof result === 'object') {
                   return this.secureProxy(result);
               }
               return result;
           }
        }

        if (value && typeof value === 'object') {
          return this.secureProxy(value);
        }

        return value;
      },
      getPrototypeOf: (target: T) => {
          return null; // Force null prototype to block prototype chain traversal
      }
    };
    return new Proxy(target, handler);
  }

  public async evaluatePatterns(chart: IFunctionalAstrolabe): Promise<Pattern[]> {
    const patterns = await this.getAllPatterns();
    const matches: Pattern[] = [];

    // Create a safe context for execution
    // We only expose the 'chart' object.
    const safeChart = this.secureProxy(chart);
    const context = vm.createContext(Object.create(null, {
        chart: {
            value: safeChart,
            writable: false,
            enumerable: true,
            configurable: false
        }
    }));

    for (const p of patterns) {
      try {
        // The script should evaluate to a boolean
        // e.g. "chart.palace('命宫').has('紫微')"

        // Additional Check: Scan script for dangerous access
        if (p.script.includes('constructor') || p.script.includes('__proto__')) {
            // console.warn(`Pattern '${p.name}' rejected due to suspicious keywords.`);
            continue;
        }

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
