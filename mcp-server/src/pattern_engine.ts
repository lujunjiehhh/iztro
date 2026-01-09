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
      if (err) console.error('Error opening database', err);
      else this.initDb();
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
    const sandbox = Object.create(null);
    sandbox.chart = secureProxy(chart);
    const context = vm.createContext(sandbox);

    for (const p of patterns) {
      try {
        if (vm.runInContext(p.script, context, { timeout: 100 }) === true) matches.push(p);
      } catch (e) {
        // Fail silently
      }
    }
    return matches;
  }
}

export const patternEngine = new PatternEngine();

const proxyCache = new WeakMap<object, any>();

function secureProxy<T extends object>(target: T): T {
  if (proxyCache.has(target)) return proxyCache.get(target);

  const handler: ProxyHandler<T> = {
    get(t, p) {
      if (p === 'constructor' || p === '__proto__' || p === 'prototype') return undefined;
      // Block Array mutation
      if (Array.isArray(t) && typeof p === 'string' && ['push', 'pop', 'shift', 'unshift', 'splice'].includes(p)) return undefined;

      const v = Reflect.get(t, p);
      if (typeof v === 'function') {
        return secureProxy(v.bind(t)); // Bind to target for internal slots
      }
      if (v && typeof v === 'object') return secureProxy(v);
      return v;
    },
    set: () => false, // Read-only
    apply(t, thisArg, args) {
      const fn = t as unknown as Function;
      // Wrap callback args to prevent leaking raw objects back to sandbox
      const safeArgs = args.map(a => typeof a === 'function' ?
        new Proxy(a, { apply: (ct, cth, ca) => Reflect.apply(ct, cth, ca.map(x => (x && typeof x === 'object') ? secureProxy(x) : x)) })
        : a);
      const res = fn.apply(thisArg, safeArgs);
      if (res && (typeof res === 'object' || typeof res === 'function')) return secureProxy(res);
      return res;
    }
  };

  const proxy = new Proxy(target, handler);
  proxyCache.set(target, proxy);
  return proxy;
}
