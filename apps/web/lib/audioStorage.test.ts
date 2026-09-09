// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRecording, loadRecording, saveRecording } from './audioStorage';
import { loadAnalysisContext, saveAnalysisContext } from './analysisContextStorage';
import { readStorage, writeStorage } from './safeStorage';

afterEach(() => { vi.restoreAllMocks(); clearRecording(); });

describe('optional browser persistence', () => {
  it('retains playback in memory when storage quota is exhausted', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError'); });
    const blob = new Blob(['audio']);
    await expect(saveRecording(blob)).resolves.toBeUndefined();
    expect(loadRecording()).toBe(blob);
    expect(() => saveAnalysisContext({ mode: 'basic', use_case: 'meetings', device_type: 'unknown' })).not.toThrow();
  });
  it('handles storage access and removal denial', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(() => clearRecording()).not.toThrow();
    expect(loadRecording()).toBeNull();
    expect(loadAnalysisContext().use_case).toBe('meetings');
    expect(readStorage('localStorage', 'key')).toBeNull();
    expect(writeStorage('localStorage', 'key', null)).toBe(false);
  });
  it('does not resurrect an old recording after reset during serialization', async () => {
    const pending = saveRecording(new Blob(['old']));
    clearRecording();
    await pending;
    expect(loadRecording()).toBeNull();
    expect(sessionStorage.getItem('miccheck-last-recording')).toBeNull();
  });
  it('validates malformed saved context', () => {
    localStorage.setItem('miccheck.analysis.context.v1', JSON.stringify({use_case:'invalid',device_type:'fake',mode:'fake'}));
    expect(loadAnalysisContext()).toMatchObject({use_case:'meetings', device_type:'unknown',mode:'single'});
  });
});
