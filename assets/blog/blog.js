(() => {
  const controls = [...document.querySelectorAll('[data-blog-filter]')];
  const cards = [...document.querySelectorAll('[data-blog-grid] [data-blog-card]')];
  const emptyState = document.querySelector('[data-blog-empty]');

  if (controls.length === 0 || cards.length === 0 || !emptyState) return;

  controls.forEach(control => {
    control.addEventListener('click', () => {
      const selectedTopic = control.dataset.blogFilter;
      let visibleCount = 0;

      controls.forEach(item => {
        const active = item === control;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });

      cards.forEach(card => {
        const visible = selectedTopic === 'all' || card.dataset.topic === selectedTopic;
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      emptyState.hidden = visibleCount !== 0;
    });
  });
})();
