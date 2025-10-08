const ONLY_DIGITS_REGEX = /\D+/g;

export const sanitizeDocument = (value?: string | null): string =>
  typeof value === "string" ? value.replace(ONLY_DIGITS_REGEX, "") : "";

export const isValidCPF = (value: string | null | undefined): boolean => {
  const digits = sanitizeDocument(value);
  if (digits.length !== 11 || /^([0-9])\1+$/.test(digits)) {
    return false;
  }

  const numbers = digits.split("").map((digit) => Number.parseInt(digit, 10));
  const calculateVerifier = (sliceLength: number): number => {
    const slice = numbers.slice(0, sliceLength);
    const sum = slice.reduce((accumulator, digit, index) => {
      return accumulator + digit * (slice.length + 1 - index);
    }, 0);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const verifierOne = calculateVerifier(9);
  const verifierTwo = calculateVerifier(10);

  return verifierOne === numbers[9] && verifierTwo === numbers[10];
};

export const isValidCNPJ = (value: string | null | undefined): boolean => {
  const digits = sanitizeDocument(value);
  if (digits.length !== 14 || /^([0-9])\1+$/.test(digits)) {
    return false;
  }

  const numbers = digits.split("").map((digit) => Number.parseInt(digit, 10));
  const calculateVerifier = (sliceLength: number, factors: number[]): number => {
    const slice = numbers.slice(0, sliceLength);
    const sum = slice.reduce((accumulator, digit, index) => {
      return accumulator + digit * (factors[index] ?? 0);
    }, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const factorsOne = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const factorsTwo = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const verifierOne = calculateVerifier(12, factorsOne);
  const verifierTwo = calculateVerifier(13, factorsTwo);

  return verifierOne === numbers[12] && verifierTwo === numbers[13];
};
