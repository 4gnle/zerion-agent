import { expect, test } from 'vitest';
import { displayAmount } from '../lib/display-amount';
test.each([
  ['0.00005555', '≈ 0.00005'],
  ['0.00009999', '≈ 0.00009'],
  ['0.000000000000000019', '≈ 0.00000000000000001'],
  ['0.00005', '0.00005'],
  ['0.001000', '0.001'],
  ['0', '0'], ['0.000', '0'],
  ['12.987', '≈ 12.9'], ['123', '123'], ['2.7', '2.7'],
  ['9007199254740993.12', '≈ 9007199254740993.1'],
])('display %s as %s without rounding', (input, expected) => {
  expect(displayAmount(input)).toBe(expected);
});
