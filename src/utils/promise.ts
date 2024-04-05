export function Sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function YieldAnd(action: () => void, ms = 0) {
  setTimeout(action, ms);
}
