export function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}
