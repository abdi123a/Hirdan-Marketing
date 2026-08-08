import { describe, it, expect } from 'vitest';
import {
  splitSections,
  parseHorizontalShare,
  parseAgeGender,
  parseFollows,
} from './meta-audience-import.service.js';
import { decodeCsvBuffer, splitCsvLine } from './import-utils.js';

// Shaped exactly like a real Instagram Insights export: UTF-16LE, a `sep=,`
// directive, and blank-line-separated sections in mixed orientations.
const SAMPLE = [
  'sep=,',
  '"Top countries"',
  '"Djibouti","Somalia"',
  '"71.4","8.9"',
  '',
  '"Age & gender"',
  '"","Women","Men"',
  '"18-24","3.9","3.8"',
  '"25-34","9.5","9.7"',
  '',
  '"Top cities"',
  '"Djibouti City","Balbala"',
  '"58.3","12.6"',
  '',
  '"Follows"',
  '"Date","Primary"',
  '"2026-07-18T00:00:00","37"',
  '"2026-07-19T00:00:00","71"',
  '',
].join('\r\n');

describe('decodeCsvBuffer', () => {
  it('decodes UTF-16LE with a BOM, which is how Meta writes these files', () => {
    const buf = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('"Top countries"', 'utf16le'),
    ]);
    expect(decodeCsvBuffer(buf)).toBe('"Top countries"');
  });

  it('strips a UTF-8 BOM instead of leaving it on the first token', () => {
    expect(decodeCsvBuffer(Buffer.from('﻿sep=,', 'utf8'))).toBe('sep=,');
  });
});

describe('splitCsvLine', () => {
  it('keeps commas that sit inside quoted city names', () => {
    expect(splitCsvLine('"New York, New York","Los Angeles, California"'))
      .toEqual(['New York, New York', 'Los Angeles, California']);
  });

  it('unescapes doubled quotes', () => {
    expect(splitCsvLine('"say ""hi""",2')).toEqual(['say "hi"', '2']);
  });
});

describe('splitSections', () => {
  it('splits the export into its titled sections and drops the sep directive', () => {
    const sections = splitSections(SAMPLE);
    expect(sections.map(s => s.title)).toEqual([
      'Top countries', 'Age & gender', 'Top cities', 'Follows',
    ]);
  });

  it('keeps a single-column value row as data, not as a new section title', () => {
    // "United States"/"100" is a one-country export — both lines are data even
    // though each holds a single cell, and misreading either as a title would
    // silently drop the country split.
    const sections = splitSections('"Top countries"\n"United States"\n"100"\n');
    expect(sections).toHaveLength(1);
    expect(sections[0].rows).toEqual([['United States'], ['100']]);
  });
});

describe('parseHorizontalShare', () => {
  it('zips the label row against the percentage row as 0..1 fractions', () => {
    const sections = splitSections(SAMPLE);
    const countries = parseHorizontalShare(sections[0].rows);
    expect(countries).toEqual([
      { label: 'Djibouti', fraction: 0.714 },
      { label: 'Somalia', fraction: 0.089 },
    ]);
  });

  it('drops pairs missing either half rather than emitting a NaN fraction', () => {
    expect(parseHorizontalShare([['A', 'B', 'C'], ['10', '', '30']])).toEqual([
      { label: 'A', fraction: 0.1 },
      { label: 'C', fraction: 0.3 },
    ]);
  });
});

describe('parseAgeGender', () => {
  it('collapses the cross-tab into consistent age and gender marginals', () => {
    const sections = splitSections(SAMPLE);
    const { age, gender } = parseAgeGender(sections[1].rows);

    // Age brackets sum across the gender columns.
    expect(age).toEqual([
      { label: '18-24', fraction: expect.closeTo(0.077, 5) },
      { label: '25-34', fraction: expect.closeTo(0.192, 5) },
    ]);
    // Genders sum down their own column.
    expect(gender).toEqual([
      { label: 'Women', fraction: expect.closeTo(0.134, 5) },
      { label: 'Men', fraction: expect.closeTo(0.135, 5) },
    ]);
  });

  it('reads both marginals off the same cells so they stay mutually consistent', () => {
    const { age, gender } = parseAgeGender(splitSections(SAMPLE)[1].rows);
    const ageTotal = age.reduce((s, a) => s + a.fraction, 0);
    const genderTotal = gender.reduce((s, g) => s + g.fraction, 0);
    expect(ageTotal).toBeCloseTo(genderTotal, 5);
  });
});

describe('parseFollows', () => {
  it('reads dated follow counts and skips the header row', () => {
    const follows = parseFollows(splitSections(SAMPLE)[3].rows);
    expect(follows).toHaveLength(2);
    expect(follows[0].follows).toBe(37);
    expect(follows[0].date.toISOString()).toBe('2026-07-18T00:00:00.000Z');
  });
});
