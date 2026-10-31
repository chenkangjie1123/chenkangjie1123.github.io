import { CoAdaptationDemo } from './coadapt-demo.js?v=20261031-1';

const host = document.querySelector('#artifact-demo');
const next = document.querySelector('#artifact-next');
const demo = new CoAdaptationDemo(host);
next.hidden = false;
demo.onModeChange = mode => {
  next.textContent = mode === 'results' ? 'Next: Why it happens →' : '← Back to the scene comparison';
};
next.addEventListener('click', () => {
  demo.setMode(demo.mode === 'results' ? 'mechanism' : 'results');
  host.querySelector('[role="tab"][aria-selected="true"]').focus({ preventScroll: true });
});
const visibility = new IntersectionObserver(([entry]) => {
  demo.inView = entry.isIntersecting;
}, { threshold: 0.1 });
visibility.observe(host);
window.addEventListener('pagehide', event => {
  if (!event.persisted) { visibility.disconnect(); demo.destroy(); }
});
