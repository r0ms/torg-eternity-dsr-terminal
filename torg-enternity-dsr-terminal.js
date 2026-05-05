import { DSRTerminalApp } from "./lib/TorgEternityDSRTerminal.js";

Hooks.once("init", async () => {
  const templatePaths = [
    "modules/torg-eternity-dsr-terminal/templates/app/dsr-terminal.hbs",
    "modules/torg-eternity-dsr-terminal/templates/app/dsr-form.hbs",
    "modules/torg-eternity-dsr-terminal/templates/app/dsr-archive.hbs",
    "modules/torg-eternity-dsr-terminal/templates/chatcard/dsr-chat-card.hbs",
  ];
  await loadTemplates(templatePaths);
  
  console.log("DSR Terminal | Templates Loaded and Partials Registered");
});

Hooks.once('preRenderTorgControlButtons', (app, context, options) => {
  const { buttons } = context 
  const dsrButton = {
    name: 'dsrTerminal',
    label: 'DSR Terminal',
    icon: 'fa-solid fa-terminal',
    type: 'button'
  };
  buttons.unshift(dsrButton)
});

Hooks.on('renderTorgControlButtons', (app, html) => {
    const btn = html.querySelector('button[name="dsrTerminal"]');
    if (!btn) return;
    btn.addEventListener('click', (event) => {
        console.log("DSR Terminal Triggered");
        const existing = Object.values(ui.windows).find(w => w instanceof DSRTerminalApp);
        if (existing) existing.render(true, { focus: true });
        else new DSRTerminalApp().render(true);
    });
});