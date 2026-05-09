import { describe, expect, it } from 'vitest';
import { countChartedCommands } from './OverviewBarChart';

describe('countChartedCommands', () => {
  it('returns 0 when no counts are available', () => {
    expect(countChartedCommands({}, {})).toBe(0);
  });

  it('counts only roots with positive usage and positive time estimates', () => {
    expect(
      countChartedCommands(
        {
          nav: 7,
          edit: 1,
          plugin: 0,
          user: 4,
          menu: -2,
        },
        {
          nav: 20,
          edit: 0,
          plugin: 10,
          user: 15,
          menu: 30,
        }
      )
    ).toBe(2);
  });

  it('ignores roots that are missing an estimate', () => {
    expect(
      countChartedCommands(
        {
          nav: 1,
          edit: 1,
        },
        {
          nav: 10,
        }
      )
    ).toBe(1);
  });
});
