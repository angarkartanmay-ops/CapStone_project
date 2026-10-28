import { mountHeader } from './core.js';
import { cardEl } from './cards.js';

mountHeader();
for (const art of document.querySelectorAll('[data-cards]')) {
  for (const c of JSON.parse(art.dataset.cards)) {
    if (c === 'sep') {
      art.insertAdjacentHTML('beforeend', '<span class="sep" aria-hidden="true">→</span>');
    } else art.appendChild(cardEl(c));
  }
}
