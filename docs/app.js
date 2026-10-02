const records = document.querySelector('#records');
const filter = document.querySelector('#filter');

function commentClass(comment) {
  if (comment.status === 'none') return 'none';
  if (comment.status === 'counted') return 'counted';
  return 'review';
}

function commentLabel(comment) {
  if (comment.status === 'none') return 'No public comment recorded';
  if (comment.status === 'counted') return `${comment.speaker_count} counted comment${comment.speaker_count === 1 ? '' : 's'}`;
  if (comment.status === 'not-recorded') return 'No item-specific comment record';
  return 'Public comment needs review';
}

function voteLabel(votes) {
  if (votes.status === 'verification-needed') return 'Outcome recorded; individual votes need verification';
  return Object.entries(votes.members).map(([name, vote]) => `${name}: ${vote}`).join(' · ');
}

function show(data) {
  const actions = data.actions;
  document.querySelector('#action-count').textContent = actions.length;
  document.querySelector('#comment-count').textContent = actions.filter(a => a.public_comment.status === 'counted').length;
  document.querySelector('#no-comment-count').textContent = actions.filter(a => a.public_comment.status === 'none').length;

  function render() {
    const selected = filter.value;
    const visible = actions.filter(action => {
      const status = action.public_comment.status;
      return selected === 'all' || (selected === 'commented' && status === 'counted') || (selected === 'none' && status === 'none') || (selected === 'needs-review' && !['counted', 'none'].includes(status));
    });
    records.innerHTML = visible.map(action => {
      const c = action.public_comment;
      const evidence = action.evidence.map(e => `${e.file.replace('-city-council-minutes.pdf', '')}, p. ${e.page}`).join('; ');
      return `<article class="record ${commentClass(c)}">
        <div class="record-head"><p>${action.date} · ${action.item_label}</p><span class="tag ${commentClass(c)}">${commentLabel(c)}</span></div>
        <h3>${action.title}</h3>
        <dl><div><dt>Outcome</dt><dd class="outcome">${action.outcome}</dd></div><div><dt>Public-comment record</dt><dd>${c.note}</dd></div><div><dt>Recorded vote</dt><dd>${voteLabel(action.votes)}</dd></div><div><dt>Evidence</dt><dd>${evidence}</dd></div></dl>
      </article>`;
    }).join('') || '<p class="empty">No records match this filter.</p>';
  }
  filter.addEventListener('change', render);
  render();
}

fetch('data/actions.json').then(response => response.json()).then(show).catch(() => {
  records.innerHTML = '<p class="empty">The public data file could not be loaded.</p>';
});
