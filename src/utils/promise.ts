export function Sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function YieldAnd(action: () => void, ms: number = 0) {
  setTimeout(action, ms);
}
