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

  public async addPattern(pattern: Pattern): Promise<number> {
    this.validateScript(pattern.script);
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

  private validateScript(script: string) {
    if (script.length > 1000) {
      throw new Error('Script too long (max 1000 chars)');
    }

    // Blacklist of dangerous keywords
    const blacklist = [
      'process',
      'require',
      'eval',
      'Function',
      'constructor',
      '__proto__',
      'prototype',
      'import',
      'global',
      'globalThis'
    ];

    for (const word of blacklist) {
      // Regex to match whole words but allow property access (e.g. "data.process" is safe)
      // We look for the word preceded by the start of the string or a non-dot character
      // Note: This isn't perfect parsing but reduces false positives for common property names
      const regex = new RegExp(`(^|[^.])\\b${word}\\b`);
      if (regex.test(script)) {
         throw new Error(`Security Error: Script contains forbidden keyword '${word}'`);
      }
    }
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

    // Create a safe context for execution
    // We only expose the 'chart' object.
    const context = vm.createContext({ chart });

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
