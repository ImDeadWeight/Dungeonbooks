import { describe, expect, it } from 'vitest';
import { linksFromClaims } from './oldLinks';

const claim = (partnerId: string) => ({ linkId: 'l', partnerId, confirmed: true });

describe('linksFromClaims', () => {
  it('keeps pairs that claim each other', () => {
    expect(linksFromClaims({ c1: claim('n1') }, { n1: claim('c1') })).toEqual({ c1: 'n1' });
  });

  it('drops claims the other side never made back', () => {
    expect(linksFromClaims({ c1: claim('n1'), c2: claim('n2') }, { n1: claim('c9') })).toEqual({});
  });

  it('ignores damaged claims', () => {
    expect(linksFromClaims({ c1: null, c2: { partnerId: 7 } }, { n1: claim('c1') })).toEqual({});
  });
});
