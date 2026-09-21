import { beforeEach, describe, expect, it } from 'vitest';
import { clearSettings, getSetting, getSettings, patchSettings, setSetting } from './settings';
import { resetDmdbForTests } from './testSupport';

describe('persistence/settings', () => {
  beforeEach(async () => {
    await resetDmdbForTests();
  });

  it('liefert anfangs ein leeres Objekt', async () => {
    await expect(getSettings()).resolves.toEqual({});
  });

  it('liefert undefined für nie gesetzte Schlüssel', async () => {
    await expect(getSetting('activeDbId')).resolves.toBeUndefined();
    await patchSettings({ sidebarWidth: 240 });
    await expect(getSetting('activeTabId')).resolves.toBeUndefined();
  });

  it('führt Teil-Updates zusammen, statt sie zu überschreiben', async () => {
    await patchSettings({ activeDbId: 'builtin:musik-streaming', sidebarWidth: 240 });
    await patchSettings({ adhocSql: 'SELECT 1;' });

    await expect(getSettings()).resolves.toEqual({
      activeDbId: 'builtin:musik-streaming',
      sidebarWidth: 240,
      adhocSql: 'SELECT 1;',
    });
  });

  it('überschreibt einzelne Werte und behält Arrays bei', async () => {
    await patchSettings({ openTabs: ['tab-a', 'tab-b'], activeTabId: 'tab-a' });
    const after = await patchSettings({ activeTabId: 'tab-b' });

    expect(after.openTabs).toEqual(['tab-a', 'tab-b']);
    expect(after.activeTabId).toBe('tab-b');
  });

  it('löscht einen Wert, wenn der Patch undefined enthält', async () => {
    await patchSettings({ storageNoticeSeen: true, splitRatio: 0.6 });
    await patchSettings({ storageNoticeSeen: undefined });

    await expect(getSettings()).resolves.toEqual({ splitRatio: 0.6 });
    await expect(getSetting('storageNoticeSeen')).resolves.toBeUndefined();
  });

  it('setSetting schreibt einen einzelnen Wert, clearSettings räumt auf', async () => {
    await setSetting('activeDbId', 'db-1');
    await expect(getSetting('activeDbId')).resolves.toBe('db-1');

    await clearSettings();
    await expect(getSettings()).resolves.toEqual({});
  });
});
