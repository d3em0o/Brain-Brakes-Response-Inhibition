export function button(label: string, action: string, variant = 'primary'): string {
  return `<button class="btn ${variant}" type="button" data-action="${action}">${label}</button>`;
}

export function screenShell(title: string, body: string, actions = ''): string {
  return `
    <section class="screen-card">
      <h1>${title}</h1>
      <div class="screen-body">${body}</div>
      <div class="actions">${actions}</div>
    </section>
  `;
}
