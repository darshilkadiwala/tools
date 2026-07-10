import { describe, expect, it } from 'vitest';

import { calculateEMI } from '@/lib/calculations';
import type { Loan } from '@/types';

import {
  calculateMoratoriumMonthInterestWithDisbursements,
  calculateSimpleMoratoriumMonthInterest,
  generateMoratoriumSchedule,
} from './moratorium';

const trancheLoan: Loan = {
  id: 'edu-sbi',
  name: 'SBI Education Loan',
  type: 'education',
  principal: 560_137,
  interestRate: 10.55,
  tenureMonths: 84,
  startDate: '2018-10-15T00:00:00.000Z',
  emiStartDate: '2024-03-05T00:00:00.000Z',
  emiAmount: calculateEMI(560_137, 10.55, 84),
  interestAccrualMethod: 'actual_365',
  disbursements: [
    { date: '2018-10-15T00:00:00.000Z', amount: 98_700, label: 'EDU disb' },
    { date: '2019-01-10T00:00:00.000Z', amount: 25_087, label: 'EDU disb' },
    { date: '2019-06-25T00:00:00.000Z', amount: 28_250, label: 'University' },
  ],
  createdAt: '2018-10-15T00:00:00.000Z',
  updatedAt: '2018-10-15T00:00:00.000Z',
};

describe('moratorium interest with mid-month disbursements', () => {
  it('uses simple interest on each disbursed tranche for SBI-style moratorium', () => {
    const result = calculateSimpleMoratoriumMonthInterest(
      [{ date: '2018-10-15T00:00:00.000Z', amount: 98_700 }],
      10.5,
      [],
      new Date('2018-11-01'),
      'actual_365',
      'round',
    );

    expect(result.interest).toBe(852);
  });

  it('matches bank-style Nov/Dec on first tranche at 10.5%', () => {
    const disbursements = [{ date: '2018-10-15T00:00:00.000Z', amount: 98_700 }];

    const nov = calculateSimpleMoratoriumMonthInterest(
      disbursements,
      10.5,
      [],
      new Date('2018-11-01'),
      'actual_365',
      'round',
    );
    const dec = calculateSimpleMoratoriumMonthInterest(
      disbursements,
      10.5,
      [],
      new Date('2018-12-01'),
      'actual_365',
      'round',
    );

    expect(nov.interest).toBe(852);
    expect(dec.interest).toBe(880);
  });

  it('accrues per-tranche split-period interest for a month with a new tranche', () => {
    const result = calculateSimpleMoratoriumMonthInterest(
      [
        { date: '2018-10-15T00:00:00.000Z', amount: 98_700 },
        { date: '2019-01-10T00:00:00.000Z', amount: 25_087 },
      ],
      10.55,
      [],
      new Date('2019-01-01'),
      'actual_365',
      'round',
    );

    expect(result.interest).toBe(1044);
  });

  it('creates one moratorium row per month when a tranche lands mid-month', () => {
    const { entries } = generateMoratoriumSchedule(trancheLoan);
    const janMoratoriumRows = entries.filter(
      (entry) => entry.isMoratorium && !entry.isDisbursement && entry.dueDate.includes('2019-01'),
    );
    const junMoratoriumRows = entries.filter(
      (entry) => entry.isMoratorium && !entry.isDisbursement && entry.dueDate.includes('2019-06'),
    );

    expect(janMoratoriumRows).toHaveLength(1);
    expect(janMoratoriumRows[0]?.interest).toBe(1044);
    expect(junMoratoriumRows).toHaveLength(1);
  });

  it('still accrues part-month interest when the first disbursement is mid-month', () => {
    const { entries } = generateMoratoriumSchedule(trancheLoan);
    const octMoratoriumRows = entries.filter(
      (entry) => entry.isMoratorium && !entry.isDisbursement && entry.dueDate.includes('2018-10'),
    );

    expect(octMoratoriumRows).toHaveLength(1);
    expect(octMoratoriumRows[0]?.interest).toBe(485);
  });

  it('keeps compound-on-outstanding mode when explicitly selected', () => {
    const compoundLoan: Loan = {
      ...trancheLoan,
      moratoriumInterestMode: 'compound_on_outstanding',
    };
    const result = calculateMoratoriumMonthInterestWithDisbursements(
      100_924,
      [{ date: '2019-01-10T00:00:00.000Z', amount: 25_087 }],
      10.55,
      [],
      new Date('2019-01-01'),
      'actual_365',
      'round',
    );

    expect(result.interest).toBe(1064);
    expect(
      generateMoratoriumSchedule(compoundLoan).entries.filter(
        (entry) => entry.isMoratorium && !entry.isDisbursement && entry.dueDate.includes('2019-01'),
      )[0]?.interest,
    ).toBe(1064);
  });
});
