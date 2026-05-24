export async function initTooltipPlatform() {
  const jobs: Array<Promise<unknown>> = [];

  if (!('popover' in HTMLElement.prototype)) {
    jobs.push(import('@oddbird/popover-polyfill/fn').then(({ apply }) => apply()));
  }

  if (!('anchorName' in document.documentElement.style)) {
    jobs.push(import('@oddbird/css-anchor-positioning'));
  }

  if (!('interestForElement' in HTMLButtonElement.prototype)) {
    jobs.push(import('interestfor'));
  }

  if (jobs.length > 0) {
    await Promise.all(jobs);
  }
}
