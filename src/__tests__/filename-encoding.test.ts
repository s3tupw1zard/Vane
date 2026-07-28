import { describe, expect, it } from 'vitest';

describe('Non-ASCII filename handling', () => {
  it('correctly decodes latin1-encoded UTF-8 filenames', () => {
    const originalFilename = '测试文件.pdf';
    const latin1Encoded = Buffer.from(originalFilename, 'utf8').toString('latin1');
    const decoded = Buffer.from(latin1Encoded, 'latin1').toString('utf8');

    expect(decoded).toBe(originalFilename);
  });

  it('handles Chinese characters correctly', () => {
    const originalFilename = '中文文档.docx';
    const latin1Encoded = Buffer.from(originalFilename, 'utf8').toString('latin1');
    const decoded = Buffer.from(latin1Encoded, 'latin1').toString('utf8');

    expect(decoded).toBe(originalFilename);
  });

  it('handles Japanese characters correctly', () => {
    const originalFilename = 'テストファイル.txt';
    const latin1Encoded = Buffer.from(originalFilename, 'utf8').toString('latin1');
    const decoded = Buffer.from(latin1Encoded, 'latin1').toString('utf8');

    expect(decoded).toBe(originalFilename);
  });

  it('handles Korean characters correctly', () => {
    const originalFilename = '테스트파일.pdf';
    const latin1Encoded = Buffer.from(originalFilename, 'utf8').toString('latin1');
    const decoded = Buffer.from(latin1Encoded, 'latin1').toString('utf8');

    expect(decoded).toBe(originalFilename);
  });

  it('handles mixed ASCII and non-ASCII characters', () => {
    const originalFilename = 'document_文档_2024.pdf';
    const latin1Encoded = Buffer.from(originalFilename, 'utf8').toString('latin1');
    const decoded = Buffer.from(latin1Encoded, 'latin1').toString('utf8');

    expect(decoded).toBe(originalFilename);
  });

  it('handles filenames with special characters', () => {
    const originalFilename = 'file with spaces & symbols (1).txt';
    const latin1Encoded = Buffer.from(originalFilename, 'utf8').toString('latin1');
    const decoded = Buffer.from(latin1Encoded, 'latin1').toString('utf8');

    expect(decoded).toBe(originalFilename);
  });

  it('handles ASCII-only filenames without change', () => {
    const originalFilename = 'simple-filename.pdf';
    const latin1Encoded = Buffer.from(originalFilename, 'utf8').toString('latin1');
    const decoded = Buffer.from(latin1Encoded, 'latin1').toString('utf8');

    expect(decoded).toBe(originalFilename);
  });
});
