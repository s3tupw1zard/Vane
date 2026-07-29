import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { UserRole, AuthUser, SessionUser } from '@/lib/auth';
import { runMigrations } from '@/lib/db/migrate';

const migrationsDir = path.join(process.cwd(), 'drizzle');
const temporaryRoots: string[] = [];

function createDatabase(): { db: Database.Database; root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-migration-test-'));
  temporaryRoots.push(root);
  return {
    db: new Database(path.join(root, 'db.sqlite')),
    root,
  };
}

function createLegacySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE chats (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      focusMode TEXT NOT NULL,
      files TEXT DEFAULT '[]'
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      chatId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      type TEXT,
      metadata TEXT
    );
  `);
}

function createIntermediateSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE chats (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      focusMode TEXT NOT NULL,
      files TEXT DEFAULT '[]'
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      chatId TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      messageId TEXT NOT NULL,
      content TEXT,
      sources TEXT DEFAULT '[]'
    );
  `);
}

function createCurrentSchema(
  db: Database.Database,
  options: { auth?: boolean; userId?: boolean } = {},
): void {
  const { auth = true, userId = true } = options;
  db.exec(`
    CREATE TABLE chats (
      id TEXT PRIMARY KEY,
      ${userId ? "userId TEXT NOT NULL DEFAULT 'anonymous'," : ''}
      title TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      sources TEXT DEFAULT '[]',
      files TEXT DEFAULT '[]'
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      messageId TEXT NOT NULL,
      chatId TEXT NOT NULL,
      backendId TEXT NOT NULL,
      query TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      responseBlocks TEXT DEFAULT '[]',
      status TEXT DEFAULT 'answering'
    );
    ${
      auth
        ? `
          CREATE TABLE users (
            id TEXT PRIMARY KEY NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user' NOT NULL,
            createdAt TEXT NOT NULL
          );
          CREATE TABLE sessions (
            id TEXT PRIMARY KEY NOT NULL,
            userId TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            createdAt TEXT NOT NULL
          );
        `
        : ''
    }
  `);
}

function columnNames(db: Database.Database, table: string): string[] {
  return (
    db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
      name: string;
    }>
  ).map((column) => column.name);
}

function migrationNames(db: Database.Database): string[] {
  return (
    db.prepare('SELECT name FROM ran_migrations ORDER BY name').all() as Array<{
      name: string;
    }>
  ).map((row) => row.name);
}

function applicationSnapshot(db: Database.Database): string {
  const tables = ['chats', 'messages', 'users', 'sessions'].filter((table) =>
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table),
  );
  return JSON.stringify(
    tables.map((table) => ({
      table,
      columns: db.prepare(`PRAGMA table_info("${table}")`).all(),
      rows: db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all(),
    })),
  );
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('DB migration runner', () => {
  it('migrates an empty database to the current schema', async () => {
    const { db } = createDatabase();
    try {
      const result = await runMigrations(db, migrationsDir);

      expect(columnNames(db, 'chats')).toEqual([
        'id',
        'title',
        'createdAt',
        'sources',
        'files',
        'userId',
      ]);
      expect(columnNames(db, 'messages')).toEqual([
        'id',
        'messageId',
        'chatId',
        'backendId',
        'query',
        'createdAt',
        'responseBlocks',
        'status',
      ]);
      expect(columnNames(db, 'users')).toEqual([
        'id',
        'username',
        'password_hash',
        'role',
        'createdAt',
      ]);
      expect(migrationNames(db)).toEqual([
        '0000',
        '0001',
        '0002',
        '0003',
        '0004',
      ]);
      expect(result.backupPath).toBeNull();
    } finally {
      db.close();
    }
  });

  it('preserves legacy messages, timestamps, and sources', async () => {
    const { db } = createDatabase();
    try {
      createLegacySchema(db);
      db.exec(`
        CREATE TABLE messages_with_sources (
          id INTEGER PRIMARY KEY,
          type TEXT NOT NULL,
          chatId TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          messageId TEXT NOT NULL,
          content TEXT,
          sources TEXT DEFAULT '[]'
        );
        INSERT INTO messages_with_sources
          (type, chatId, createdAt, messageId, content, sources)
        VALUES ('user', 'stale', '2025-01-01', 'stale', 'stale', '[]');
      `);
      db.prepare(
        'INSERT INTO chats (id, title, createdAt, focusMode, files) VALUES (?, ?, ?, ?, ?)',
      ).run('chat-1', 'Legacy chat', '2026-01-01T10:00:00Z', 'webSearch', '[]');
      const insert = db.prepare(`
        INSERT INTO messages (id, content, chatId, messageId, type, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        1,
        'What changed?',
        'chat-1',
        'question-1',
        'user',
        JSON.stringify(JSON.stringify({ createdAt: '2026-01-01T10:01:00Z' })),
      );
      insert.run(
        2,
        'The migration changed.',
        'chat-1',
        'answer-1',
        'assistant',
        JSON.stringify({
          createdAt: '2026-01-01T10:02:00Z',
          sources: JSON.stringify([
            { title: 'Migration source', url: 'https://example.com' },
          ]),
        }),
      );

      const result = await runMigrations(db, migrationsDir);
      const messages = db
        .prepare('SELECT * FROM messages ORDER BY id')
        .all() as Array<{
        query: string;
        createdAt: string;
        responseBlocks: string;
        status: string;
      }>;

      expect(messages).toHaveLength(1);
      expect(messages[0].query).toBe('What changed?');
      expect(messages[0].createdAt).toBe('2026-01-01T10:01:00Z');
      expect(messages[0].status).toBe('completed');
      expect(JSON.parse(messages[0].responseBlocks)).toEqual([
        expect.objectContaining({
          type: 'text',
          data: 'The migration changed.',
        }),
        expect.objectContaining({
          type: 'source',
          data: [{ title: 'Migration source', url: 'https://example.com' }],
        }),
      ]);
      expect(result.backupPath).not.toBeNull();
      expect(fs.existsSync(result.backupPath!)).toBe(true);

      const backup = new Database(result.backupPath!, { readonly: true });
      expect(
        backup.prepare('SELECT COUNT(*) AS count FROM messages').get(),
      ).toEqual({
        count: 2,
      });
      backup.close();
    } finally {
      db.close();
    }
  });

  it('preserves complete and trailing incomplete intermediate conversations', async () => {
    const { db } = createDatabase();
    try {
      createIntermediateSchema(db);
      db.prepare(
        'INSERT INTO chats (id, title, createdAt, focusMode, files) VALUES (?, ?, ?, ?, ?)',
      ).run(
        'chat-1',
        'Intermediate chat',
        '2026-02-01T10:00:00Z',
        'webSearch',
        '[]',
      );
      const insert = db.prepare(`
        INSERT INTO messages (id, type, chatId, createdAt, messageId, content, sources)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        1,
        'user',
        'chat-1',
        '2026-02-01T10:01:00Z',
        'question-1',
        'First',
        '[]',
      );
      insert.run(
        2,
        'assistant',
        'chat-1',
        '2026-02-01T10:02:00Z',
        'answer-1',
        'Answer',
        '[]',
      );
      insert.run(
        3,
        'source',
        'chat-1',
        '2026-02-01T10:02:00Z',
        'answer-1-source',
        '',
        JSON.stringify(JSON.stringify([{ title: 'Late source' }])),
      );
      insert.run(
        4,
        'user',
        'chat-1',
        '2026-02-01T10:03:00Z',
        'question-2',
        'Second',
        '[]',
      );

      const result = await runMigrations(db, migrationsDir);
      const messages = db
        .prepare(
          'SELECT query, createdAt, responseBlocks, status FROM messages ORDER BY id',
        )
        .all() as Array<{
        query: string;
        createdAt: string;
        responseBlocks: string;
        status: string;
      }>;

      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({
        query: 'First',
        createdAt: '2026-02-01T10:01:00Z',
        status: 'completed',
      });
      expect(JSON.parse(messages[0].responseBlocks)).toEqual([
        expect.objectContaining({ type: 'text', data: 'Answer' }),
        expect.objectContaining({
          type: 'source',
          data: [{ title: 'Late source' }],
        }),
      ]);
      expect(messages[1]).toMatchObject({
        query: 'Second',
        createdAt: '2026-02-01T10:03:00Z',
        status: 'answering',
      });
      expect(JSON.parse(messages[1].responseBlocks)).toEqual([
        expect.objectContaining({ type: 'text', data: '' }),
      ]);
      expect(result.backupPath).not.toBeNull();
    } finally {
      db.close();
    }
  });

  it('baselines an untracked current schema without changing application data', async () => {
    const { db } = createDatabase();
    try {
      createCurrentSchema(db);
      db.prepare(
        'INSERT INTO chats (id, userId, title, createdAt, sources, files) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('chat-1', 'user-1', 'Current chat', '2026-03-01', '["web"]', '[]');
      db.prepare(
        `
        INSERT INTO messages
          (id, messageId, chatId, backendId, query, createdAt, responseBlocks, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        7,
        'message-1',
        'chat-1',
        'backend-1',
        'Keep me',
        '2026-03-01',
        '[]',
        'completed',
      );
      const before = applicationSnapshot(db);

      const result = await runMigrations(db, migrationsDir);

      expect(applicationSnapshot(db)).toBe(before);
      expect(migrationNames(db)).toEqual([
        '0000',
        '0001',
        '0002',
        '0003',
        '0004',
      ]);
      expect(result.backupPath).toBeNull();
    } finally {
      db.close();
    }
  });

  it('reconciles the reported current schema with only 0000 tracked', async () => {
    const { db } = createDatabase();
    try {
      createCurrentSchema(db);
      db.exec(`
        CREATE TABLE ran_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          run_on DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO ran_migrations (name) VALUES ('0000');
        INSERT INTO chats (id, userId, title, createdAt, sources, files)
        VALUES ('chat-1', 'anonymous', 'Reported state', '2026-04-01', '[]', '[]');
      `);
      const before = applicationSnapshot(db);

      await expect(runMigrations(db, migrationsDir)).resolves.toMatchObject({
        backupPath: null,
      });
      expect(applicationSnapshot(db)).toBe(before);
      expect(migrationNames(db)).toEqual([
        '0000',
        '0001',
        '0002',
        '0003',
        '0004',
      ]);
    } finally {
      db.close();
    }
  });

  it('upgrades a pre-auth schema while preserving chats and messages', async () => {
    const { db } = createDatabase();
    try {
      createCurrentSchema(db, { auth: false, userId: false });
      db.exec(`
        CREATE TABLE ran_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          run_on DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO ran_migrations (name) VALUES
          ('0000'), ('0001'), ('0002'), ('0003'), ('0004');
        INSERT INTO chats (id, title, createdAt, sources, files)
        VALUES ('chat-1', 'Pre-auth chat', '2026-05-01', '["web"]', '[]');
        INSERT INTO messages
          (messageId, chatId, backendId, query, createdAt, responseBlocks, status)
        VALUES
          ('message-1', 'chat-1', 'backend-1', 'Preserve me', '2026-05-01', '[]', 'completed');
      `);
      const chatBefore = db.prepare('SELECT * FROM chats').get();
      const messageBefore = db.prepare('SELECT * FROM messages').get();

      await runMigrations(db, migrationsDir);

      expect(columnNames(db, 'users')).toContain('password_hash');
      expect(columnNames(db, 'sessions')).toContain('expiresAt');
      expect(columnNames(db, 'chats')).toContain('userId');
      expect(
        db
          .prepare('SELECT id, title, createdAt, sources, files FROM chats')
          .get(),
      ).toEqual(chatBefore);
      expect(db.prepare('SELECT * FROM messages').get()).toEqual(messageBefore);
      expect(db.prepare('SELECT userId FROM chats').get()).toEqual({
        userId: 'anonymous',
      });
      expect(migrationNames(db)).toEqual([
        '0000',
        '0001',
        '0002',
        '0003',
        '0004',
      ]);
    } finally {
      db.close();
    }
  });

  it('is idempotent after the database is fully migrated', async () => {
    const { db } = createDatabase();
    try {
      await runMigrations(db, migrationsDir);
      db.prepare(
        'INSERT INTO chats (id, userId, title, createdAt, sources, files) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('chat-1', 'anonymous', 'Stable chat', '2026-06-01', '[]', '[]');
      const before = applicationSnapshot(db);
      const trackingBefore = migrationNames(db);

      const secondRun = await runMigrations(db, migrationsDir);

      expect(applicationSnapshot(db)).toBe(before);
      expect(migrationNames(db)).toEqual(trackingBefore);
      expect(secondRun).toEqual({ backupPath: null, appliedMigrations: [] });
    } finally {
      db.close();
    }
  });

  it('rejects an unknown schema without changing schema, data, or tracking', async () => {
    const { db } = createDatabase();
    try {
      db.exec(`
        CREATE TABLE chats (id TEXT PRIMARY KEY, unexpected TEXT);
        CREATE TABLE messages (id INTEGER PRIMARY KEY, mystery TEXT);
        INSERT INTO chats (id, unexpected) VALUES ('chat-1', 'keep');
        INSERT INTO messages (id, mystery) VALUES (1, 'keep');
      `);
      const before = JSON.stringify(
        db
          .prepare(
            'SELECT type, name, sql FROM sqlite_master ORDER BY type, name',
          )
          .all(),
      );

      await expect(runMigrations(db, migrationsDir)).rejects.toThrow(
        /unknown or inconsistent.*chats=\[id, unexpected\].*messages=\[id, mystery\]/i,
      );
      expect(
        JSON.stringify(
          db
            .prepare(
              'SELECT type, name, sql FROM sqlite_master ORDER BY type, name',
            )
            .all(),
        ),
      ).toBe(before);
      expect(db.prepare('SELECT * FROM chats').all()).toEqual([
        { id: 'chat-1', unexpected: 'keep' },
      ]);
    } finally {
      db.close();
    }
  });

  it('leaves source data and tracking unchanged after a transformation failure', async () => {
    const { db } = createDatabase();
    try {
      createLegacySchema(db);
      db.exec(`
        CREATE TABLE ran_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          run_on DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO ran_migrations (name) VALUES ('0000');
        INSERT INTO chats (id, title, createdAt, focusMode, files)
        VALUES ('chat-1', 'Rollback chat', '2026-07-01', 'webSearch', '[]');
        INSERT INTO messages (id, content, chatId, messageId, type, metadata)
        VALUES
          (1, 'Valid first row', 'chat-1', 'message-1', 'user', '{"createdAt":"2026-07-01"}'),
          (2, 'Invalid role', 'chat-1', 'message-2', 'system', '{"createdAt":"2026-07-01"}');
      `);
      const before = applicationSnapshot(db);

      await expect(runMigrations(db, migrationsDir)).rejects.toThrow(
        'Legacy message row 2 has unknown role system',
      );
      expect(applicationSnapshot(db)).toBe(before);
      expect(migrationNames(db)).toEqual(['0000']);
      expect(columnNames(db, 'messages_with_sources')).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('rolls back SQL and tracking together when a migration body fails', async () => {
    const { db, root } = createDatabase();
    const testMigrations = path.join(root, 'migrations');
    fs.cpSync(migrationsDir, testMigrations, { recursive: true });
    fs.writeFileSync(
      path.join(testMigrations, '0005_forced_failure.sql'),
      [
        'CREATE TABLE forced_partial_state (id INTEGER PRIMARY KEY);',
        '--> statement-breakpoint',
        'INSERT INTO forced_partial_state (id) VALUES (1);',
        '--> statement-breakpoint',
        'SELECT missing_column FROM messages;',
      ].join('\n'),
    );

    try {
      createCurrentSchema(db);
      await expect(runMigrations(db, testMigrations)).rejects.toThrow(
        /missing_column/,
      );

      expect(columnNames(db, 'forced_partial_state')).toEqual([]);
      expect(migrationNames(db)).toEqual([
        '0000',
        '0001',
        '0002',
        '0003',
        '0004',
      ]);
    } finally {
      db.close();
    }
  });
});

describe('DB Schema - TypeScript type smoke tests', () => {
  it('users and sessions schema modules load without error', async () => {
    const schema = await import('@/lib/db/schema');
    expect(schema.users).toBeDefined();
    expect(schema.sessions).toBeDefined();
  });

  it('UserRole type allows admin and user', () => {
    const roles: UserRole[] = ['admin', 'user'];
    expect(roles).toContain('admin');
    expect(roles).toContain('user');
  });

  it('AuthUser has required fields', () => {
    const user: AuthUser = { id: 'test', username: 'test', role: 'user' };
    expect(user.id).toBe('test');
    expect(user.role).toBe('user');
  });

  it('SessionUser includes sessionId', () => {
    const session: SessionUser = {
      id: 'test',
      username: 'test',
      role: 'admin',
      sessionId: 'sess-1',
    };
    expect(session.sessionId).toBe('sess-1');
  });
});
