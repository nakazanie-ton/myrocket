const DECIMAL = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/;

interface Parts {
  value: bigint;
  scale: number;
}

function parts(input: string): Parts {
  const match = DECIMAL.exec(input);
  if (!match) throw new Error(`Invalid decimal value: ${input}`);
  const fraction = match[1] ?? "";
  return {
    value: BigInt(input.replace(".", "")),
    scale: fraction.length,
  };
}

function power10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function align(left: Parts, right: Parts): readonly [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.value * power10(scale - left.scale),
    right.value * power10(scale - right.scale),
    scale,
  ];
}

function format(value: bigint, scale: number): string {
  if (scale === 0) return value.toString();
  const raw = value.toString().padStart(scale + 1, "0");
  const whole = raw.slice(0, -scale);
  const fraction = raw.slice(-scale).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function compareDecimals(left: string, right: string): number {
  const [leftValue, rightValue] = align(parts(left), parts(right));
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

export function addDecimals(left: string, right: string): string {
  const [leftValue, rightValue, scale] = align(parts(left), parts(right));
  return format(leftValue + rightValue, scale);
}

export function subtractDecimals(left: string, right: string): string {
  const [leftValue, rightValue, scale] = align(parts(left), parts(right));
  if (rightValue > leftValue) throw new Error("Decimal subtraction would be negative");
  return format(leftValue - rightValue, scale);
}

export function multiplyDecimals(left: string, right: string): string {
  const leftParts = parts(left);
  const rightParts = parts(right);
  return format(leftParts.value * rightParts.value, leftParts.scale + rightParts.scale);
}

export function sumDecimals(values: readonly string[]): string {
  return values.reduce(addDecimals, "0");
}
