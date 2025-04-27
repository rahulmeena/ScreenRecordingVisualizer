/// <reference types="@testing-library/jest-dom" />

interface CustomMatchers<R = unknown> {
  toBeInTheDocument(): R;
  toHaveTextContent(text: string | RegExp): R;
  toHaveAttribute(attr: string, value?: string | RegExp): R;
  toHaveClass(...classNames: string[]): R;
  toBeVisible(): R;
  toBeDisabled(): R;
  toBeEnabled(): R;
  toBeChecked(): R;
}

declare namespace jest {
  interface Matchers<R> extends CustomMatchers<R> {}
} 