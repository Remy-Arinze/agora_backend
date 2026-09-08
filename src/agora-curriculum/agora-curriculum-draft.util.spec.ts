import { nextCurriculumVersion, shouldReuseInFlightDraft } from './agora-curriculum-draft.util';

describe('agora-curriculum-draft.util', () => {
  it('reuses a draft that has no topics yet', () => {
    expect(shouldReuseInFlightDraft({ status: 'DRAFT', topicCount: 0 })).toBe(true);
  });

  it('reuses an incomplete draft instead of minting v2', () => {
    expect(shouldReuseInFlightDraft({ status: 'DRAFT', topicCount: 23 })).toBe(true);
    expect(shouldReuseInFlightDraft({ status: 'DRAFT', topicCount: 38 })).toBe(true);
  });

  it('mints a new version when reconsolidating a complete library row', () => {
    expect(shouldReuseInFlightDraft({ status: 'DRAFT', topicCount: 39 }, { forceNewVersion: true })).toBe(false);
    expect(shouldReuseInFlightDraft({ status: 'DRAFT', topicCount: 23 }, { forceNewVersion: true })).toBe(false);
    expect(shouldReuseInFlightDraft({ status: 'DRAFT', topicCount: 0 }, { forceNewVersion: true })).toBe(true);
  });

  it('mints a new version after a complete draft or published row', () => {
    expect(shouldReuseInFlightDraft({ status: 'DRAFT', topicCount: 39 })).toBe(false);
    expect(shouldReuseInFlightDraft({ status: 'PUBLISHED', topicCount: 12 })).toBe(false);
    expect(nextCurriculumVersion({ version: 1 })).toBe(2);
  });

  it('starts at version 1 when nothing exists', () => {
    expect(shouldReuseInFlightDraft(null)).toBe(false);
    expect(nextCurriculumVersion(null)).toBe(1);
  });
});
